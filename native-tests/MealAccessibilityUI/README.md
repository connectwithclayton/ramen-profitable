# Meal accessibility native regression

This XCUITest exercises the eligible Store -> Ramen run -> $80 / 4-meal quote on an isolated iPhone simulator. It runs at standard, Accessibility Large, and maximum Dynamic Type, then verifies:

- the complete quote is horizontally contained and reachable
- Confirm and Cancel are fully inside the viewport and hittable
- meal purchase targets are at least 44 points tall
- cancellation leaves the fixture's cash unchanged

Install and launch the Debug development client once on a dedicated simulator, start Metro, then run:

```sh
SIMULATOR_UDID=<dedicated-simulator-udid> \
METRO_DEEP_LINK='exp+ramen-profitable://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A18979' \
native-tests/MealAccessibilityUI/run.sh
```

The runner backs up and restores that app's AsyncStorage and the simulator's content-size setting. It writes `.xcresult` bundles, including screenshots, beneath `.expo/meal-accessibility-native-test` unless `NATIVE_TEST_OUTPUT_DIR` is set.
