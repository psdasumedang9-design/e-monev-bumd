E-Monev Package — FULL (Apps Script + HTML embeds + logos)
Files:
- Code.gs              : Full Google Apps Script backend (replace SPREADSHEET_ID)
- dashboard.html       : Dashboard embed (replace WEB_APP_URL)
- login_input.html     : Login & Input embed (replace WEB_APP_URL)
- detail.html          : Detail page (replace WEB_APP_URL)
- logos/               : included logo images (optional - these are local files)

Quick setup:
1. Create a Google Spreadsheet and add sheets (tabs): User, Laporan, BUMD, Log.
   - User header: username | password_hash | bumd | token | token_expiry
   - Laporan header: timestamp | bumd | pencapaian | target | persentase | catatan | submitted_by
   - BUMD header: bumd | logo_url | description
   - Log header: timestamp | event | username | info

2. Open Extensions -> Apps Script in that spreadsheet. Create a new project and replace the default Code.gs content with the Code.gs file here. Replace SPREADSHEET_ID in Code.gs with your spreadsheet ID.
3. Run the function seedSampleData() once from the Apps Script editor (click Run). Accept any authorization prompts.
4. Deploy -> New deployment -> select "Web app". Choose "Execute as: Me" and "Who has access: Anyone". Deploy and copy the Web app URL.
5. Replace WEB_APP_URL in the HTML files with the Web app URL from step 4.
6. Host the HTML files somewhere accessible or paste them into Canva's Embed (if your Canva plan supports JS). If Canva doesn't allow JS, host the files (GitHub Pages or simple web hosting) and embed via iframe in Canva.
7. Test using sample users created by seedSampleData():
   - pdam_sumedang / pdam2025 => PDAM Tirta Medal
   - bpr_sumedang / bpr2025  => Perumda BPR Bank Sumedang
   - lkm_sumedang / lkm2025  => PT. LKM
   - km_sumedang / km2025    => PT. Kampung Makmur

Notes:
- Replace logo URLs in the BUMD sheet with public URLs (we included local copies in this package under logos/).
- For production security: consider Google Sign-In or OAuth, salted password hashing, and restricting Web App access.
- The export function writes temporary files to your Drive and returns a Drive URL. Clean up if needed.
