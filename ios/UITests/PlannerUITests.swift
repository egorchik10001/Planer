import XCTest

final class PlannerUITests: XCTestCase {
    @MainActor
    func testTasksPersistAfterRelaunch() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["Сегодня"].firstMatch.waitForExistence(timeout: 30), app.debugDescription)

        let title = "Check iPhone " + String(UUID().uuidString.prefix(8))
        let add = app.buttons["Добавить дело"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        let input = app.textViews["Название дела"].firstMatch
        XCTAssertTrue(input.waitForExistence(timeout: 10), app.debugDescription)
        input.tap()
        input.typeText(title)
        let save = app.buttons["Сохранить"].firstMatch
        if !save.isHittable { app.swipeUp() }
        save.tap()
        XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Сохранено на iPhone"].firstMatch.waitForExistence(timeout: 10))
        app.terminate()

        app.launch()
        XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
        let week = app.buttons["Неделя"].firstMatch
        XCTAssertTrue(week.exists)
        week.tap()
        XCTAssertTrue(app.staticTexts["Дела · по времени"].firstMatch.waitForExistence(timeout: 10))
    }

    @MainActor
    func testSyncSettingsAreReachable() {
        let app = XCUIApplication()
        app.launch()
        let space = app.buttons.containing(.staticText, identifier: "На iPhone").firstMatch
        XCTAssertTrue(space.waitForExistence(timeout: 25), app.debugDescription)
        space.tap()
        XCTAssertTrue(app.staticTexts["Синхронизация"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Открыть сервер"].firstMatch.exists)
        app.buttons["Назад в планер"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Неделя"].firstMatch.waitForExistence(timeout: 10))
    }
}
