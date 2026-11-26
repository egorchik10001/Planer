import XCTest

final class PlannerUITests: XCTestCase {
    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    @MainActor
    func testTasksPersistAfterRelaunch() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["Сегодня"].firstMatch.waitForExistence(timeout: 30), app.debugDescription)

        let title = "Check iPhone " + String(UUID().uuidString.prefix(8))
        let add = app.buttons["Добавить текстом"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        XCTAssertTrue(add.isHittable)
        add.tap()
        let input = app.textViews.matching(NSPredicate(
            format: "label == %@ OR placeholderValue == %@", "Название дела", "Что нужно сделать?"
        )).firstMatch
        XCTAssertTrue(input.waitForExistence(timeout: 10), app.debugDescription)
        input.tap()
        input.typeText(title)
        let save = app.buttons["Сохранить"].firstMatch
        XCTAssertTrue(save.isHittable, app.debugDescription)
        save.tap()
        let card = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10), app.debugDescription)
        let saved = app.buttons["Сохранено на iPhone. Нажмите, чтобы обновить"].firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 10), app.debugDescription)
        app.terminate()

        app.launch()
        XCTAssertTrue(card.waitForExistence(timeout: 20), app.debugDescription)
        let week = app.buttons["Неделя"].firstMatch
        XCTAssertTrue(week.exists)
        week.tap()
        XCTAssertTrue(app.staticTexts["Дела · по времени"].firstMatch.waitForExistence(timeout: 10))
    }

    @MainActor
    func testSyncSettingsAreReachable() {
        let app = XCUIApplication()
        app.launch()
        let space = app.buttons["На iPhone"].firstMatch
        XCTAssertTrue(space.waitForExistence(timeout: 25), app.debugDescription)
        space.tap()
        XCTAssertTrue(app.staticTexts["Синхронизация"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Открыть сервер"].firstMatch.exists)
        app.buttons["Назад в планер"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Неделя"].firstMatch.waitForExistence(timeout: 10))
    }
}
