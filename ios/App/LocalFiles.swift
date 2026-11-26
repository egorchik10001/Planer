import Foundation

enum PlannerError: LocalizedError {
    case failure(String)

    var errorDescription: String? {
        if case let .failure(message) = self { message } else { nil }
    }
}

struct LocalFiles {
    private let root: URL
    let attachments: URL
    let models: URL

    init() throws {
        root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appending(path: "Planner", directoryHint: .isDirectory)
        attachments = root.appending(path: "Attachments", directoryHint: .isDirectory)
        var modelDirectory = root.appending(path: "Models", directoryHint: .isDirectory)
        for directory in [attachments, modelDirectory] {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try modelDirectory.setResourceValues(values)
        models = modelDirectory
    }

    private var plan: URL { root.appending(path: "plan.json") }
    private var previous: URL { root.appending(path: "plan.previous.json") }

    func planText(previous usePrevious: Bool = false) throws -> String? {
        let url = usePrevious ? previous : plan
        guard FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) else { return nil }
        return try String(contentsOf: url, encoding: .utf8)
    }

    func savePlan(_ text: String) throws {
        let data = Data(text.utf8)
        guard data.count <= 100 * 1024 * 1024 else { throw PlannerError.failure("План больше 100 МБ.") }
        if FileManager.default.fileExists(atPath: plan.path(percentEncoded: false)) {
            try Data(contentsOf: plan).write(to: previous, options: .atomic)
        }
        try data.write(to: plan, options: .atomic)
    }

    func recoverPlan() throws {
        let data = try Data(contentsOf: previous)
        if FileManager.default.fileExists(atPath: plan.path(percentEncoded: false)) {
            try FileManager.default.copyItem(at: plan, to: root.appending(path: "plan.damaged-\(UUID().uuidString).json"))
        }
        try data.write(to: plan, options: .atomic)
    }

    func listAttachmentKeys() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: attachments.path(percentEncoded: false))
            .filter { UUID(uuidString: $0) != nil }.map { "mac-local/" + $0 }
    }

    func attachment(_ id: String) throws -> URL {
        guard UUID(uuidString: id) != nil else { throw PlannerError.failure("Неверное вложение.") }
        return attachments.appending(path: id)
    }
}
