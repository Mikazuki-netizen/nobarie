import UIKit
import WebKit
import Capacitor
import AVFoundation
import NetworkExtension
import Network
import Photos

class MainViewController: CAPBridgeViewController, WKUIDelegate, WKScriptMessageHandler {
    private var localNetworkBrowser: NWBrowser?
    private var activeHotspotSsid: String?
    private weak var originalUIDelegate: WKUIDelegate?

    // Active file stream buffers for gallery saving
    private var activeFileHandles: [String: FileHandle] = [:]
    private var activeTempUrls: [String: URL] = [:]
    private var activeMimeTypes: [String: String] = [:]
    private var activeFileNames: [String: String] = [:]

    override func viewDidLoad() {
        super.viewDidLoad()
        self.originalUIDelegate = self.webView?.uiDelegate
        self.webView?.uiDelegate = self
        
        // 1. Request camera access explicitly at native iOS level
        AVCaptureDevice.requestAccess(for: .video) { granted in
            print("[NoBarier] Camera permission status: \(granted)")
        }

        // 2. Request Photo Library access explicitly
        if #available(iOS 14.0, *) {
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
                print("[NoBarier] Photo library auth status: \(status.rawValue)")
            }
        } else {
            PHPhotoLibrary.requestAuthorization { status in
                print("[NoBarier] Photo library auth status: \(status.rawValue)")
            }
        }

        // 3. Trigger iOS Local Network Privacy prompt
        triggerLocalNetworkDiscovery()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if self.webView?.uiDelegate !== self {
            self.originalUIDelegate = self.webView?.uiDelegate
            self.webView?.uiDelegate = self
        }
    }

    private func triggerLocalNetworkDiscovery() {
        let params = NWParameters()
        params.includePeerToPeer = true
        let browser = NWBrowser(for: .bonjour(type: "_nobarier._tcp", domain: nil), using: params)
        self.localNetworkBrowser = browser
        browser.stateUpdateHandler = { state in
            print("[NoBarier] Local network probe state: \(state)")
        }
        browser.start(queue: .main)
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "nativeWifi")
        config.userContentController.add(self, name: "nativeGallery")
        return config
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        if let original = originalUIDelegate {
            original.webView?(webView, runJavaScriptAlertPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        if let original = originalUIDelegate {
            original.webView?(webView, runJavaScriptConfirmPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler(true)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        if let original = originalUIDelegate {
            original.webView?(webView, runJavaScriptTextInputPanelWithPrompt: prompt, defaultText: defaultText, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler(defaultText)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        return originalUIDelegate?.webView?(webView, createWebViewWith: configuration, for: navigationAction, windowFeatures: windowFeatures)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "nativeWifi", let dict = message.body as? [String: Any] {
            let action = dict["action"] as? String ?? ""
            if action == "join", let ssid = dict["ssid"] as? String {
                activeHotspotSsid = ssid
                let pass = dict["password"] as? String
                joinHotspot(ssid: ssid, password: pass)
            } else if action == "disconnect" {
                let targetSsid = (dict["ssid"] as? String) ?? activeHotspotSsid
                if let ssid = targetSsid, !ssid.isEmpty {
                    NEHotspotConfigurationManager.shared.removeConfiguration(forSSID: ssid)
                    print("[NoBarier] Unpaired and disconnected from hotspot: \(ssid)")
                }
                activeHotspotSsid = nil
            }
            return
        }

        if message.name == "nativeGallery", let dict = message.body as? [String: Any] {
            let action = dict["action"] as? String ?? ""
            
            if action == "startFile" {
                let transferId = dict["transferId"] as? String ?? UUID().uuidString
                let fileName = dict["fileName"] as? String ?? "file"
                let mimeType = dict["mimeType"] as? String ?? ""
                let tempDir = FileManager.default.temporaryDirectory
                let tempUrl = tempDir.appendingPathComponent("nobarier_\(transferId)_\(fileName)")
                try? FileManager.default.removeItem(at: tempUrl)
                FileManager.default.createFile(atPath: tempUrl.path, contents: nil, attributes: nil)
                if let handle = FileHandle(forWritingAtPath: tempUrl.path) {
                    activeFileHandles[transferId] = handle
                    activeTempUrls[transferId] = tempUrl
                    activeMimeTypes[transferId] = mimeType
                    activeFileNames[transferId] = fileName
                }
            } else if action == "appendChunk" {
                let transferId = dict["transferId"] as? String ?? ""
                let base64Chunk = dict["base64Chunk"] as? String ?? ""
                if let handle = activeFileHandles[transferId], let data = Data(base64Encoded: base64Chunk) {
                    if #available(iOS 13.4, *) {
                        try? handle.write(contentsOf: data)
                    } else {
                        handle.write(data)
                    }
                }
            } else if action == "finishFile" {
                let transferId = dict["transferId"] as? String ?? ""
                let callbackId = dict["callbackId"] as? String ?? ""
                if let handle = activeFileHandles.removeValue(forKey: transferId) {
                    try? handle.close()
                }
                guard let tempUrl = activeTempUrls.removeValue(forKey: transferId) else {
                    let js = "window.onNativeGalleryFinish && window.onNativeGalleryFinish('\(callbackId)', false, '', 'Temp file missing');"
                    self.webView?.evaluateJavaScript(js, completionHandler: nil)
                    return
                }
                let mimeType = activeMimeTypes.removeValue(forKey: transferId) ?? ""
                let fileName = activeFileNames.removeValue(forKey: transferId) ?? tempUrl.lastPathComponent

                let ext = tempUrl.pathExtension.lowercased()
                let isVideo = mimeType.starts(with: "video/") || ["mp4", "mov", "m4v", "mkv", "webm", "avi"].contains(ext)
                let isPhoto = mimeType.starts(with: "image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic"].contains(ext)

                if isVideo || isPhoto {
                    var localId: String?
                    PHPhotoLibrary.shared().performChanges({
                        let request = PHAssetCreationRequest.forAsset()
                        let opt = PHAssetResourceCreationOptions()
                        opt.originalFilename = fileName
                        if isVideo {
                            request.addResource(with: .video, fileURL: tempUrl, options: opt)
                        } else {
                            request.addResource(with: .photo, fileURL: tempUrl, options: opt)
                        }
                        localId = request.placeholderForCreatedAsset?.localIdentifier
                    }) { success, error in
                        try? FileManager.default.removeItem(at: tempUrl)
                        DispatchQueue.main.async {
                            let errStr = error?.localizedDescription.replacingOccurrences(of: "'", with: "\\'") ?? ""
                            let idStr = localId?.replacingOccurrences(of: "'", with: "\\'") ?? ""
                            let js = "window.onNativeGalleryFinish && window.onNativeGalleryFinish('\(callbackId)', \(success), '\(idStr)', '\(errStr)');"
                            self.webView?.evaluateJavaScript(js, completionHandler: nil)
                        }
                    }
                } else {
                    // Documents / Audio / Other files: Save to Documents directory (visible in Files app)
                    if let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                        let targetUrl = docsDir.appendingPathComponent(fileName)
                        try? FileManager.default.removeItem(at: targetUrl)
                        do {
                            try FileManager.default.moveItem(at: tempUrl, to: targetUrl)
                            DispatchQueue.main.async {
                                let pathStr = targetUrl.path.replacingOccurrences(of: "'", with: "\\'")
                                let js = "window.onNativeGalleryFinish && window.onNativeGalleryFinish('\(callbackId)', true, '\(pathStr)', '');"
                                self.webView?.evaluateJavaScript(js, completionHandler: nil)
                            }
                        } catch {
                            DispatchQueue.main.async {
                                let errStr = error.localizedDescription.replacingOccurrences(of: "'", with: "\\'")
                                let js = "window.onNativeGalleryFinish && window.onNativeGalleryFinish('\(callbackId)', false, '', '\(errStr)');"
                                self.webView?.evaluateJavaScript(js, completionHandler: nil)
                            }
                        }
                    }
                }
            } else if action == "deleteMedia" {
                let localId = dict["localId"] as? String ?? ""
                let fileName = dict["fileName"] as? String ?? ""
                let callbackId = dict["callbackId"] as? String ?? ""

                if !localId.isEmpty {
                    let assets = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
                    if assets.count > 0 {
                        PHPhotoLibrary.shared().performChanges({
                            PHAssetChangeRequest.deleteAssets(assets)
                        }) { success, error in
                            DispatchQueue.main.async {
                                let errStr = error?.localizedDescription.replacingOccurrences(of: "'", with: "\\'") ?? ""
                                let js = "window.onNativeGalleryDelete && window.onNativeGalleryDelete('\(callbackId)', \(success), '\(errStr)');"
                                self.webView?.evaluateJavaScript(js, completionHandler: nil)
                            }
                        }
                        return
                    }
                }

                // Check Documents directory
                if let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first, !fileName.isEmpty {
                    let targetUrl = docsDir.appendingPathComponent(fileName)
                    if FileManager.default.fileExists(atPath: targetUrl.path) {
                        try? FileManager.default.removeItem(at: targetUrl)
                    }
                }

                let js = "window.onNativeGalleryDelete && window.onNativeGalleryDelete('\(callbackId)', true, '');"
                self.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
            return
        }
    }

    private func joinHotspot(ssid: String, password: String?) {
        if #available(iOS 11.0, *) {
            let config: NEHotspotConfiguration
            if let p = password, !p.isEmpty {
                config = NEHotspotConfiguration(ssid: ssid, passphrase: p, isWEP: false)
            } else {
                config = NEHotspotConfiguration(ssid: ssid)
            }
            config.joinOnce = true
            NEHotspotConfigurationManager.shared.apply(config) { error in
                if let err = error {
                    print("[NoBarier] Hotspot apply error: \(err.localizedDescription)")
                } else {
                    print("[NoBarier] Successfully joined hotspot: \(ssid)")
                }
            }
        }
    }
}


class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

