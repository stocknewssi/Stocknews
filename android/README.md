# StockNewsWala Android App

This is the first native Android starter for StockNewsWala, kept in a separate `android/` folder so the existing Cloudflare website files stay untouched.

## Current starter features
- Native Android UI with a light theme
- Search Indian equity instruments through the existing Worker API
- Filter results by NSE or BSE
- Request a live quote when a stock is selected
- Clear error states when live data is unavailable (never label demo prices as live)

## Build
Open the `android/` folder in Android Studio and let Gradle sync. Then run the app on an Android device or emulator.

## API
The app currently calls:
- `GET /api/stocks?q=...&exchange=...&limit=50`
- `GET /api/market?symbols=SYMBOL`

Base URL is configured in `app/build.gradle.kts`. Update it only after the production website/API URL is confirmed.

## Important
- No API secrets belong in this Android app. Market provider credentials must remain on the Cloudflare Worker.
- Live quotes require valid server-side Angel One credentials and the provider's applicable data/display permissions.
- The website is not modified by these starter files.
