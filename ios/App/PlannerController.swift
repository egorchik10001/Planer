import UIKit
import WebKit

@MainActor
final class PlannerController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let stack = UIStackView()
    private let localButton = UIButton(type: .system)
    private var localWebView: WKWebView?
    private var displayedWebView: WKWebView?
    private var remoteOrigin: URL?
    private var files: LocalFiles?
    private var voice: VoiceModels?
    private let recorder = Recorder()
    private var voiceBusy = false
    private var presentingShare = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 233/255, green: 235/255, blue: 223/255, alpha: 1)
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        localButton.setTitle("‹  План на iPhone", for: .normal)
        localButton.setTitleColor(.label, for: .normal)
        localButton.contentHorizontalAlignment = .leading
        localButton.configuration = .plain()
        localButton.configuration?.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 18, bottom: 10, trailing: 18)
        localButton.addAction(UIAction { [weak self] _ in self?.openLocal() }, for: .touchUpInside)
        stack.addArrangedSubview(localButton)
        localButton.isHidden = true
        do {
            let files = try LocalFiles()
            self.files = files
            voice = try VoiceModels(folder: files.models)
            if UserDefaults.standard.bool(forKey: "useServer"),
               let address = UserDefaults.standard.string(forKey: "serverAddress"),
               let url = Self.serverURL(address) { openServer(url) }
            else { openLocal() }
        } catch {
            showError("Не удалось открыть данные Планера", error.localizedDescription)
        }
    }

    private func makeWebView(local: Bool) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let bridge = MessageBridge(controller: self)
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "planner")
        if let script = Bundle.main.url(forResource: "device-bridge", withExtension: "js"),
           let source = try? String(contentsOf: script, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        if local, let root = Bundle.main.resourceURL?.appending(path: "web", directoryHint: .isDirectory) {
            configuration.setURLSchemeHandler(BundledPages(root: root), forURLScheme: BundledPages.scheme)
        }
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }

    private func display(_ webView: WKWebView, local: Bool) {
        if let current = displayedWebView {
            if current !== webView { recorder.cancel() }
            stack.removeArrangedSubview(current)
            current.removeFromSuperview()
        }
        displayedWebView = webView
        stack.addArrangedSubview(webView)
        localButton.isHidden = local
    }

    private func openLocal(voiceSettings: Bool = false) {
        UserDefaults.standard.set(false, forKey: "useServer")
        remoteOrigin = nil
        if let localWebView {
            display(localWebView, local: true)
            if voiceSettings {
                localWebView.evaluateJavaScript("window.dispatchEvent(new Event('planner:voice-settings'))", completionHandler: nil)
            }
            return
        }
        let webView = makeWebView(local: true)
        localWebView = webView
        display(webView, local: true)
        guard let url = URL(string: voiceSettings ? "plannerapp://app/#voice" : "plannerapp://app/") else { return }
        webView.load(URLRequest(url: url))
    }

    private func openServer(_ url: URL) {
        let webView = makeWebView(local: false)
        remoteOrigin = url
        UserDefaults.standard.set(url.absoluteString, forKey: "serverAddress")
        UserDefaults.standard.set(true, forKey: "useServer")
        display(webView, local: false)
        webView.load(URLRequest(url: url))
    }

    private static func serverURL(_ address: String) -> URL? {
        guard address.count <= 2048, let c = URLComponents(string: address), c.scheme == "https",
              let host = c.host, !host.isEmpty, c.user == nil, c.password == nil,
              c.query == nil, c.fragment == nil, c.path == "/" || c.path.isEmpty else { return nil }
        var origin = URLComponents()
        origin.scheme = "https"
        origin.host = host.lowercased()
        origin.port = c.port == 443 ? nil : c.port
        origin.path = "/"
        return origin.url
    }

    private func isServer(_ url: URL?) -> Bool {
        guard let url, let remoteOrigin else { return false }
        return url.scheme == "https" && url.host()?.lowercased() == remoteOrigin.host()?.lowercased() &&
            (url.port ?? 443) == (remoteOrigin.port ?? 443) && url.user() == nil && url.password() == nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if webView === localWebView ? BundledPages.isLocal(url) : isServer(url) {
            if action.targetFrame == nil {
                webView.load(action.request)
                return .cancel
            }
            return .allow
        }
        if action.navigationType == .linkActivated, url.scheme == "https" || url.scheme == "tg" {
            await UIApplication.shared.open(url)
        }
        return .cancel
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: any Error) {
        guard webView === displayedWebView, (error as NSError).code != NSURLErrorCancelled else { return }
        showError("Не удалось открыть план", webView === localWebView
                  ? "Попробуй заново запустить Планер."
                  : "Проверь адрес сервера и интернет. Кнопка «План на iPhone» вернёт к локальным делам.")
    }

    func webView(_ webView: WKWebView, decideMediaCapturePermissionsFor origin: WKSecurityOrigin, initiatedBy frame: WKFrameInfo, type: WKMediaCaptureType) async -> WKPermissionDecision {
        // The bundled interface uses the recorder below. Web pages never control raw camera or microphone access.
        .deny
    }

    fileprivate func handle(_ message: WKScriptMessage) async throws -> Any? {
        guard message.frameInfo.isMainFrame, let webView = message.webView, webView === displayedWebView,
              let args = message.body as? [String: Any], let action = args["action"] as? String,
              let files else { throw PlannerError.failure("Неверный запрос к приложению.") }
        let page = message.frameInfo.request.url
        if webView === localWebView, BundledPages.isLocal(page) {
            switch action {
            case "readPlan": return try files.planText() as Any? ?? NSNull()
            case "readPreviousPlan": return try files.planText(previous: true) as Any? ?? NSNull()
            case "writePlan": try files.savePlan(try string("data", in: args)); return nil
            case "recoverPlan": try files.recoverPlan(); return nil
            case "listAttachments": return try files.listAttachmentKeys()
            case "readAttachment": return try Data(contentsOf: files.attachment(try string("id", in: args))).base64EncodedString()
            case "writeAttachment":
                let url = try files.attachment(try string("id", in: args))
                try bytes(in: args, limit: 10 * 1024 * 1024).write(to: url, options: .withoutOverwriting)
                return nil
            case "serverAddress": return UserDefaults.standard.string(forKey: "serverAddress") as Any? ?? NSNull()
            case "openServer":
                guard let url = Self.serverURL(try string("address", in: args)) else {
                    throw PlannerError.failure("Введи HTTPS-адрес сервера без пути, пароля и параметров.")
                }
                openServer(url)
                return nil
            default: break
            }
        } else if !isServer(page) {
            throw PlannerError.failure("Этот адрес не подключён к Планеру.")
        }
        switch action {
        case "startRecording": try await recorder.start(); return nil
        case "stopRecording": return try recorder.finish().base64EncodedString()
        case "cancelRecording": recorder.cancel(); return nil
        case "voiceReady": return voice?.isReady ?? false
        case "voiceStatus": return voice?.status()
        case "prepareVoice": voice?.begin(); return nil
        case "pauseVoice": voice?.pause(); return nil
        case "openVoiceSettings":
            openLocal(voiceSettings: true)
            return nil
        case "transcribe":
            let data = try bytes(in: args, limit: 16 * 1024 * 1024)
            return try await runVoice(model: "speech") { url in try VoiceInference.transcribe(data: data, model: url) }
        case "interpret":
            let prompt = try string("prompt", in: args)
            return try await runVoice(model: "planner") { url in try VoiceInference.interpret(prompt: prompt, model: url) }
        case "shareFile":
            let name = try string("name", in: args)
            try share(name: name, data: bytes(in: args, limit: 100 * 1024 * 1024))
            return nil
        default: throw PlannerError.failure("Запрос недоступен.")
        }
    }

    private func runVoice(model id: String, operation: @escaping @Sendable (URL) throws -> String) async throws -> String {
        guard !voiceBusy, let voice else { throw PlannerError.failure("Дождись разбора предыдущей записи.") }
        let url = try voice.model(id)
        voiceBusy = true
        defer { voiceBusy = false }
        let work = Task.detached(priority: .userInitiated) { try operation(url) }
        return try await work.value
    }

    private func string(_ key: String, in args: [String: Any]) throws -> String {
        guard let value = args[key] as? String else { throw PlannerError.failure("Не хватает данных.") }
        return value
    }

    private func bytes(in args: [String: Any], limit: Int) throws -> Data {
        let encoded = try string("data", in: args)
        guard encoded.utf8.count <= ((limit + 2) / 3) * 4, let data = Data(base64Encoded: encoded), data.count <= limit else {
            throw PlannerError.failure("Файл слишком большой или повреждён.")
        }
        return data
    }

    private func share(name: String, data: Data) throws {
        guard !presentingShare, presentedViewController == nil, name.count <= 220, !name.isEmpty,
              name != ".", name != "..", !(name.contains("/") || name.contains("\\")) else {
            throw PlannerError.failure("Не удалось открыть меню «Поделиться».")
        }
        let directory = FileManager.default.temporaryDirectory.appending(path: "share-" + UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        let file = directory.appending(path: name)
        do { try data.write(to: file, options: .atomic) }
        catch { try? FileManager.default.removeItem(at: directory); throw error }
        let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = view
        share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        share.completionWithItemsHandler = { [weak self] _, _, _, _ in
            try? FileManager.default.removeItem(at: directory)
            Task { @MainActor in self?.presentingShare = false }
        }
        presentingShare = true
        present(share, animated: true)
    }

    private func showError(_ title: String, _ message: String) {
        guard presentedViewController == nil else { return }
        let error = UIAlertController(title: title, message: message, preferredStyle: .alert)
        error.addAction(UIAlertAction(title: "Понятно", style: .default))
        DispatchQueue.main.async { [weak self] in self?.present(error, animated: true) }
    }
}

@MainActor
private final class MessageBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var controller: PlannerController?

    init(controller: PlannerController) { self.controller = controller }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let controller else { replyHandler(nil, "Планер закрыт."); return }
        Task { @MainActor in
            do { replyHandler(try await controller.handle(message), nil) }
            catch { replyHandler(nil, error.localizedDescription) }
        }
    }
}
