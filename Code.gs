// Code.gs - FULL (Apps Script)
const SPREADSHEET_ID = "REPLACE_WITH_YOUR_SPREADSHEET_ID"; // <-- ganti
const TOKEN_TTL_MINUTES = 10; // token valid 10 menit

/* ---------- Utilities ---------- */
function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}
function nowIso(){ return new Date().toISOString(); }
function hashPassword(password) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return raw.map(b => { let s = (b < 0) ? (b + 256) : b; return ("0" + s.toString(16)).slice(-2); }).join("");
}
function generateToken(){ return Utilities.getUuid(); }
function isoPlusMinutes(min) { const d=new Date(); d.setMinutes(d.getMinutes()+min); return d.toISOString(); }
function jsonOut(o){ const out = ContentService.createTextOutput(JSON.stringify(o)); out.setMimeType(ContentService.MimeType.JSON); return out; }

/* ---------- Read / Write Helpers ---------- */
function readUsers(){
  const sh = getSheet("User");
  const rows = sh.getDataRange().getValues();
  const users = [];
  for (let i=1;i<rows.length;i++){
    users.push({ rowIndex: i+1, username: rows[i][0], password_hash: rows[i][1], bumd: rows[i][2], token: rows[i][3], token_expiry: rows[i][4] });
  }
  return users;
}
function getUserByUsername(username){
  return readUsers().find(u=>u.username===username);
}
function getUserByToken(token){
  return readUsers().find(u=>u.token===token);
}
function writeUserToken(rowIndex, token, expiry){
  const sh = getSheet("User");
  sh.getRange(rowIndex,4).setValue(token||"");
  sh.getRange(rowIndex,5).setValue(expiry||"");
}

/* ---------- Auth & Session ---------- */
function isTokenValid(user){
  if (!user || !user.token || !user.token_expiry) return false;
  return (new Date(user.token_expiry).getTime() > Date.now());
}

/* ---------- doPost: login / input / logout / validate ---------- */
function doPost(e){
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = (body.action || "").toString();
    if (action === "login") return handleLogin(body);
    if (action === "input") return handleInput(body);
    if (action === "logout") return handleLogout(body);
    if (action === "validate") return handleValidate(body);
    return jsonOut({ status:"error", message:"unknown action" });
  } catch (err) {
    return jsonOut({ status:"error", message: err.toString() });
  }
}

function handleLogin(body){
  const username = (body.username||"").toString();
  const password = (body.password||"").toString();
  if (!username || !password) return jsonOut({ status:"error", message:"username & password required" });
  const user = getUserByUsername(username);
  if (!user) return jsonOut({ status:"error", message:"user not found" });
  if (hashPassword(password) !== user.password_hash) return jsonOut({ status:"error", message:"invalid credentials" });

  const token = generateToken();
  const expiry = isoPlusMinutes(TOKEN_TTL_MINUTES);
  writeUserToken(user.rowIndex, token, expiry);
  logEvent("login", username, "success");
  return jsonOut({ status:"success", token: token, bumd: user.bumd, token_expiry: expiry });
}

function handleLogout(body){
  const token = (body.token||"").toString();
  if (!token) return jsonOut({ status:"error", message:"token required" });
  const user = getUserByToken(token);
  if (!user) return jsonOut({ status:"error", message:"invalid token" });
  writeUserToken(user.rowIndex, "", "");
  logEvent("logout", user.username, "manual logout");
  return jsonOut({ status:"success", message:"logged out" });
}

function handleValidate(body){
  const token = (body.token||"").toString();
  const user = getUserByToken(token);
  if (user && isTokenValid(user)) return jsonOut({ status:"success", bumd: user.bumd });
  return jsonOut({ status:"error", message:"invalid/expired token" });
}

/* ---------- Input ---------- */
function handleInput(body){
  const token = (body.token||"").toString();
  const user = getUserByToken(token);
  if (!user || !isTokenValid(user)) return jsonOut({ status:"error", message:"invalid/expired token" });

  const pencapaian = body.pencapaian || "";
  const target = body.target || "";
  const persentase = body.persentase || "";
  const catatan = body.catatan || "";

  const sh = getSheet("Laporan");
  sh.appendRow([ nowIso(), user.bumd, pencapaian, target, persentase, catatan, user.username ]);
  logEvent("input", user.username, `submitted for ${user.bumd}`);
  return jsonOut({ status:"success", message:"data saved" });
}

/* ---------- doGet: dashboard / detail / export ---------- */
function doGet(e){
  const action = (e.parameter.action || "").toString();
  if (action === "dashboard") return getDashboard();
  if (action === "detail") return getDetail(e);
  if (action === "export") return exportHandler(e);
  return ContentService.createTextOutput("Apps Script Web App").setMimeType(ContentService.MimeType.TEXT);
}

function getDashboard(){
  const sh = getSheet("Laporan");
  const rows = sh.getDataRange().getValues();
  const data = [];
  if (rows.length > 1){
    for (let i=1;i<rows.length;i++){
      data.push({ timestamp: rows[i][0], bumd: rows[i][1], pencapaian: rows[i][2], target: rows[i][3], persentase: rows[i][4], catatan: rows[i][5], submitted_by: rows[i][6] });
    }
  }
  const bsh = getSheet("BUMD");
  const brow = bsh.getDataRange().getValues();
  const bumds = [];
  for (let i=1;i<brow.length;i++){
    bumds.push({ bumd: brow[i][0], logo: brow[i][1], desc: brow[i][2] });
  }
  return jsonOut({ status:"success", data: data, bumds: bumds });
}

function getDetail(e){
  const name = (e.parameter.bumd || "").toString();
  if (!name) return jsonOut({ status:"error", message:"bumd required" });
  const sh = getSheet("Laporan");
  const rows = sh.getDataRange().getValues();
  const data = [];
  for (let i=1;i<rows.length;i++){
    if ((rows[i][1]||"") === name) data.push({ timestamp: rows[i][0], pencapaian: rows[i][2], target: rows[i][3], persentase: rows[i][4], catatan: rows[i][5], submitted_by: rows[i][6] });
  }
  return jsonOut({ status:"success", bumd: name, data: data });
}

/* ---------- Export ---------- */
function exportHandler(e){
  const type = (e.parameter.type || "").toString(); // excel | pdf
  const bumd = (e.parameter.bumd || "").toString(); // optional
  const sh = getSheet("Laporan");
  const rows = sh.getDataRange().getValues();
  if (rows.length <= 1) return jsonOut({ status:"error", message:"no data" });
  const header = rows[0];
  const filtered = rows.filter((r,i)=> i>0 && (!bumd || r[1] === bumd));
  const tempSS = SpreadsheetApp.create("Export_Laporan_" + (bumd || "ALL") + "_" + new Date().getTime());
  const ts = tempSS.getSheets()[0];
  ts.getRange(1,1,1,header.length).setValues([header]);
  if (filtered.length) ts.getRange(2,1,filtered.length,filtered[0].length).setValues(filtered);
  const fileId = tempSS.getId();
  if (type === "excel"){
    const file = DriveApp.getFileById(fileId).getAs(MimeType.MICROSOFT_EXCEL);
    const f = DriveApp.createFile(file).setName("Laporan_" + (bumd||"ALL") + ".xlsx");
    DriveApp.getFileById(fileId).setTrashed(true);
    return jsonOut({ status:"success", url: f.getUrl() });
  } else {
    const blob = DriveApp.getFileById(fileId).getAs('application/pdf');
    const f = DriveApp.createFile(blob).setName("Laporan_" + (bumd||"ALL") + ".pdf");
    DriveApp.getFileById(fileId).setTrashed(true);
    return jsonOut({ status:"success", url: f.getUrl() });
  }
}

/* ---------- Admin helpers ---------- */
function createUser(username, passwordPlain, bumd){
  const sh = getSheet("User");
  const hash = hashPassword(passwordPlain);
  sh.appendRow([username, hash, bumd, "", ""]);
}
function seedSampleData(){
  const u = getSheet("User"); if (u.getLastRow()===0) u.appendRow(["username","password_hash","bumd","token","token_expiry"]);
  const l = getSheet("Laporan"); if (l.getLastRow()===0) l.appendRow(["timestamp","bumd","pencapaian","target","persentase","catatan","submitted_by"]);
  const b = getSheet("BUMD"); if (b.getLastRow()===0) b.appendRow(["bumd","logo_url","description"]);
  const existingBUMD = b.getDataRange().getValues().map(r=>r[0]);
  if (existingBUMD.indexOf("PDAM Tirta Medal")===-1) b.appendRow(["PDAM Tirta Medal","/mnt/data/Logo-pam.png","PDAM Tirta Medal"]);
  if (existingBUMD.indexOf("Perumda BPR Bank Sumedang")===-1) b.appendRow(["Perumda BPR Bank Sumedang","/mnt/data/Logo-Bank-Sumedang.jpeg","Perumda BPR Bank Sumedang"]);
  if (existingBUMD.indexOf("PT. LKM")===-1) b.appendRow(["PT. LKM","/mnt/data/Logo-lkm.png","PT. LKM"]);
  if (existingBUMD.indexOf("PT. Kampung Makmur")===-1) b.appendRow(["PT. Kampung Makmur","/mnt/data/Logo-KM.png","PT. Kampung Makmur"]);
  const users = readUsers().map(u=>u.username);
  if (users.indexOf("pdam_sumedang")===-1) createUser("pdam_sumedang","pdam2025","PDAM Tirta Medal");
  if (users.indexOf("bpr_sumedang")===-1) createUser("bpr_sumedang","bpr2025","Perumda BPR Bank Sumedang");
  if (users.indexOf("lkm_sumedang")===-1) createUser("lkm_sumedang","lkm2025","PT. LKM");
  if (users.indexOf("km_sumedang")===-1) createUser("km_sumedang","km2025","PT. Kampung Makmur");
}

/* ---------- Logging ---------- */
function logEvent(event, username, info){
  const sh = getSheet("Log");
  if (!sh) return;
  sh.appendRow([ nowIso(), event, username || "", info || "" ]);
}
