import UIKit
import WebKit
import Capacitor
import AVFoundation
import NetworkExtension
import Network

class MainViewController: CAPBridgeViewController, WKUIDelegate, WKScriptMessageHandler {
    private var localNetworkBrowser: NWBrowser?
    private var activeHotspotSsid: String?

    private weak var originalUIDelegate: WKUIDelegate?

    override func viewDidLoad() {
        super.viewDidLoad()
        self.originalUIDelegate = self.webView?.uiDelegate
        self.webView?.uiDelegate = self
        
        // 1. Request camera access explicitly at native iOS level
        AVCaptureDevice.requestAccess(for: .video) { granted in
            print("[NoBarier] Camera permission status: \(granted)")
        }

        // 2. Trigger iOS Local Network Privacy prompt
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
        guard message.name == "nativeWifi", let dict = message.body as? [String: Any] else { return }
        
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

