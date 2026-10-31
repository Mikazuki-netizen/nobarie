import UIKit
import WebKit
import Capacitor
import AVFoundation

import NetworkExtension

class MainViewController: CAPBridgeViewController, WKUIDelegate, WKScriptMessageHandler {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Request camera access explicitly at native iOS level
        AVCaptureDevice.requestAccess(for: .video) { granted in
            print("[NoBarier] Camera permission status: \(granted)")
        }
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

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeWifi", let dict = message.body as? [String: Any] else { return }
        
        if let action = dict["action"] as? String, action == "join", let ssid = dict["ssid"] as? String {
            let pass = dict["password"] as? String
            joinHotspot(ssid: ssid, password: pass)
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
            config.joinOnce = false
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

