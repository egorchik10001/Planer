import Foundation
import WebKit

final class BundledPages: NSObject, WKURLSchemeHandler {
    static let scheme = "plannerapp"
    static let host = "app"

    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    static func isLocal(_ url: URL?) -> Bool {
        url?.scheme == scheme && url?.host() == host && url?.user() == nil && url?.port == nil
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url, Self.isLocal(url), (task.request.httpMethod ?? "GET") == "GET" else {
            task.didFailWithError(URLError(.unsupportedURL))
            return
        }
        let path = url.path(percentEncoded: false)
        let file = root.appending(path: path == "/" ? "index.html" : String(path.dropFirst())).standardizedFileURL
        guard file.path(percentEncoded: false).hasPrefix(root.path(percentEncoded: false) + "/"),
              let data = try? Data(contentsOf: file, options: .mappedIfSafe),
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": mime(file.pathExtension), "Content-Length": String(data.count)]) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private func mime(_ extensionName: String) -> String {
        switch extensionName {
        case "html": "text/html; charset=utf-8"
        case "js": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "txt": "text/plain; charset=utf-8"
        case "woff2": "font/woff2"
        case "png": "image/png"
        case "svg": "image/svg+xml"
        default: "application/octet-stream"
        }
    }
}
