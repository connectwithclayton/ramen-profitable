import XCTest

final class MealAccessibilityUITests: XCTestCase {
    private let bundleIdentifier = "com.clayton.ramenprofitable"
    private let orderLabel = "Review funding 4 ramen meals for $80."
    private let confirmLabel = "Confirm funding 4 ramen meals for $80. $999,920 cash will remain."

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testQuoteAndActionsAreReachableAndCancellationSpendsNothing() throws {
        let app = XCUIApplication(bundleIdentifier: bundleIdentifier)
        app.activate()

        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 15),
            "Ramen Profitable must be the foreground application before navigation"
        )
        dismissDeveloperMenuIfNeeded(in: app)

        let store = app.descendants(matching: .any)["tab-store"]
        XCTAssertTrue(store.waitForExistence(timeout: 5), "The uniquely identified Store tab must be visible")
        XCTAssertTrue(store.isHittable, "The uniquely identified Store tab must be hittable")
        store.tap()

        let ramenRun = app.staticTexts["RAMEN RUN"]
        XCTAssertTrue(ramenRun.waitForExistence(timeout: 5), "Store must contain the eligible Ramen run")

        let order = app.buttons[orderLabel]
        makeHittable(order, in: app, message: "$80 / 4-meal order")
        XCTAssertGreaterThanOrEqual(order.frame.height, 44, "Meal purchase target must be at least 44 points tall")
        order.tap()

        let quoteLabels = [
            "Total: $80.",
            "Cash after: $999,920.",
            "Lifetime after: 40,000 meals.",
        ]
        for label in quoteLabels {
            let row = app.descendants(matching: .any)[label]
            makeHittable(row, in: app, message: label)
            assertInsideViewport(row, app: app, message: label)
        }

        let confirm = app.buttons[confirmLabel]
        makeHittable(confirm, in: app, message: "Confirm")
        assertInsideViewport(confirm, app: app, message: "Confirm")

        let cancel = app.buttons["Not tonight"]
        makeHittable(cancel, in: app, message: "Cancel")
        assertInsideViewport(cancel, app: app, message: "Cancel")
        attachScreenshot(app, name: "reachable-quote-and-actions")
        cancel.tap()

        // The Store balance remaining at the fixture's exact pre-purchase value
        // proves the reachable cancellation did not commit the transaction.
        let unchangedCash = app.staticTexts["$1,000,000"]
        XCTAssertTrue(unchangedCash.waitForExistence(timeout: 5), "Cancellation must spend no cash")
    }

    private func dismissDeveloperMenuIfNeeded(in app: XCUIApplication) {
        let onboarding = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS %@", "This is the developer menu")
        ).firstMatch
        if onboarding.waitForExistence(timeout: 2) {
            let continueButton = app.buttons["Continue"]
            for _ in 0..<8 where !continueButton.isHittable {
                app.swipeUp()
            }
            XCTAssertTrue(continueButton.isHittable, "Expo's development-menu onboarding must be dismissible")
            continueButton.tap()
            XCTAssertFalse(onboarding.waitForExistence(timeout: 2), "Expo's onboarding must close")
        }

        let labelledClose = app.buttons["Close"]
        if labelledClose.waitForExistence(timeout: 1), labelledClose.isHittable {
            labelledClose.tap()
            return
        }

        let viewport = app.frame
        let topRightClose = app.buttons.allElementsBoundByIndex.first { button in
            button.isHittable
                && button.frame.midX > viewport.maxX * 0.75
                && button.frame.midY < viewport.maxY * 0.6
        }
        topRightClose?.tap()
    }

    private func makeHittable(
        _ element: XCUIElement,
        in app: XCUIApplication,
        message: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(element.waitForExistence(timeout: 5), "\(message) must exist", file: file, line: line)
        for _ in 0..<10 {
            let frame = element.frame
            let viewport = app.frame
            let fullyVisible = frame.minX >= viewport.minX - 0.5
                && frame.maxX <= viewport.maxX + 0.5
                && frame.minY >= viewport.minY - 0.5
                && frame.maxY <= viewport.maxY + 0.5
            if element.isHittable && fullyVisible { return }
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, "\(message) must be reachable and hittable", file: file, line: line)
        assertInsideViewport(element, app: app, message: message, file: file, line: line)
    }

    private func assertInsideViewport(
        _ element: XCUIElement,
        app: XCUIApplication,
        message: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let viewport = app.frame
        let frame = element.frame
        XCTAssertGreaterThanOrEqual(frame.minX, viewport.minX - 0.5, "\(message) overruns left", file: file, line: line)
        XCTAssertLessThanOrEqual(frame.maxX, viewport.maxX + 0.5, "\(message) overruns right", file: file, line: line)
        XCTAssertGreaterThanOrEqual(frame.minY, viewport.minY - 0.5, "\(message) is above the viewport", file: file, line: line)
        XCTAssertLessThanOrEqual(frame.maxY, viewport.maxY + 0.5, "\(message) is below the viewport", file: file, line: line)
    }

    private func attachScreenshot(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
