import CryptoKit
import Foundation
import os

private struct ModelSpec: Decodable, Sendable {
    let id: String
    let file: String
    let bytes: Int64
    let sha256: String
    let url: URL
}

@MainActor
final class VoiceModels {
    private enum Stage: String {
        case unavailable, verifying, missing, downloading, paused, ready, error
    }

    private let specs: [ModelSpec]
    private let folder: URL
    private let session: URLSession
    private var stage: Stage
    private var ready = Set<String>()
    private var task: URLSessionDownloadTask?
    private var ticket = UUID()
    private var errorText = ""

    init(folder: URL) throws {
        guard let manifest = Bundle.main.url(forResource: "local-models", withExtension: "json") else {
            throw PlannerError.failure("Не найдены настройки голосовых моделей.")
        }
        specs = try JSONDecoder().decode([ModelSpec].self, from: Data(contentsOf: manifest))
        self.folder = folder
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForResource = 12 * 3600
        session = URLSession(configuration: config)
        stage = ProcessInfo.processInfo.physicalMemory >= 7_000_000_000 ? .verifying : .unavailable
        if stage == .verifying { Task { await verifyExisting() } }
    }

    var isReady: Bool { stage == .ready }

    func status() -> [String: Any] {
        let total = specs.reduce(Int64(0)) { $0 + $1.bytes }
        let saved = specs.filter { ready.contains($0.id) }.reduce(Int64(0)) { $0 + $1.bytes }
        let bytes = saved + (task?.countOfBytesReceived ?? 0)
        let message: String
        switch stage {
        case .unavailable: message = "Для разбора голосовых нужны 8 ГБ оперативной памяти. Записи можно сохранять на этом iPhone."
        case .verifying: message = "Проверяю файлы моделей."
        case .missing: message = "Один раз скачай модели Whisper и Qwen. Они займут примерно 2,7 ГБ. Затем голос разбирается на iPhone без интернета."
        case .downloading: message = "Загружаю модели для работы без интернета."
        case .paused: message = "Загрузка на паузе."
        case .ready: message = "Голос готов. Запиши несколько дел и проверь результат перед сохранением."
        case .error: message = errorText
        }
        return ["stage": stage.rawValue, "description": message, "percent": total > 0 ? min(100, Int(Double(bytes) * 100 / Double(total))) : 0]
    }

    func model(_ id: String) throws -> URL {
        guard isReady, let spec = specs.first(where: { $0.id == id }) else {
            throw PlannerError.failure("Подготовь голос в настройках приложения.")
        }
        #if os(iOS) && !targetEnvironment(simulator)
        if id == "planner", os_proc_available_memory() < 3_200_000_000 {
            throw PlannerError.failure("Не хватает доступной памяти для разбора. Закрой другие тяжёлые приложения и повтори.")
        }
        #endif
        return folder.appending(path: spec.file)
    }

    func begin() {
        guard [.missing, .paused, .error].contains(stage) else { return }
        stage = .downloading
        downloadNext()
    }

    func pause() {
        guard stage == .downloading, let active = task, let spec = next else { return }
        let checkpoint = resumeFile(spec)
        stage = .verifying
        ticket = UUID()
        task = nil
        active.cancel { resumeData in
            if let resumeData { try? resumeData.write(to: checkpoint, options: .atomic) }
            Task { @MainActor in self.stage = .paused }
        }
    }

    private var next: ModelSpec? { specs.first { !ready.contains($0.id) } }

    private func resumeFile(_ spec: ModelSpec) -> URL { folder.appending(path: spec.file + ".resume") }

    private func verifyExisting() async {
        for spec in specs {
            let file = folder.appending(path: spec.file)
            let valid = await Task.detached(priority: .utility) { Self.matches(file, spec) }.value
            if valid { ready.insert(spec.id) }
        }
        stage = next == nil ? .ready : .missing
    }

    private func downloadNext() {
        guard let spec = next else { stage = .ready; return }
        let token = UUID()
        ticket = token
        let storage = folder
        let staging = storage.appending(path: "model-" + token.uuidString + ".part")
        let checkpoint = resumeFile(spec)
        let completed: @Sendable (URL?, URLResponse?, (any Error)?) -> Void = { temporary, response, downloadError in
            let result: Result<URL, any Error>
            do {
                if let downloadError { throw downloadError }
                guard let temporary, let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                    throw PlannerError.failure("Сервер не отдал файл модели.")
                }
                try FileManager.default.moveItem(at: temporary, to: staging)
                guard Self.matches(staging, spec) else { throw PlannerError.failure("Контрольная сумма модели не совпала.") }
                result = .success(staging)
            } catch { result = .failure(error) }
            Task { @MainActor in self.endDownload(spec, staging: staging, token: token, result: result) }
        }
        if let checkpointData = try? Data(contentsOf: checkpoint) {
            task = session.downloadTask(withResumeData: checkpointData, completionHandler: completed)
        } else {
            let request = URLRequest(url: spec.url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 90)
            task = session.downloadTask(with: request, completionHandler: completed)
        }
        task?.resume()
    }

    private func endDownload(_ spec: ModelSpec, staging: URL, token: UUID, result: Result<URL, any Error>) {
        defer { try? FileManager.default.removeItem(at: staging) }
        guard ticket == token else { return }
        task = nil
        let checkpoint = resumeFile(spec)
        do {
            let file = try result.get()
            let destination = folder.appending(path: spec.file)
            if FileManager.default.fileExists(atPath: destination.path(percentEncoded: false)) {
                _ = try FileManager.default.replaceItemAt(destination, withItemAt: file)
            } else {
                try FileManager.default.moveItem(at: file, to: destination)
            }
            try? FileManager.default.removeItem(at: checkpoint)
            ready.insert(spec.id)
            downloadNext()
        } catch {
            let nativeError = error as NSError
            if let data = nativeError.userInfo[NSURLSessionDownloadTaskResumeData] as? Data {
                try? data.write(to: checkpoint, options: .atomic)
            } else {
                try? FileManager.default.removeItem(at: checkpoint)
            }
            errorText = "Не удалось скачать модель. Проверь интернет и свободное место, затем повтори."
            stage = .error
        }
    }

    nonisolated private static func matches(_ file: URL, _ spec: ModelSpec) -> Bool {
        do {
            guard try file.resourceValues(forKeys: [.fileSizeKey]).fileSize.map(Int64.init) == spec.bytes else { return false }
            let handle = try FileHandle(forReadingFrom: file)
            defer { try? handle.close() }
            var digest = SHA256()
            while let data = try handle.read(upToCount: 1024 * 1024), !data.isEmpty {
                digest.update(data: data)
            }
            let value = digest.finalize().map { String(format: "%02x", $0) }.joined()
            return value == spec.sha256
        } catch { return false }
    }
}
