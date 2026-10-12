const SPREADSHEET_ID = "1ME4MdhxI6Z3dR_u2MESoEJAN5TdX7tUDq5iL29SvB5c";

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Setup function: formats sheets, headers (#03577B, bold white), and populates initial data.
 */
function initSheet() {
  const ss = getSpreadsheet();
  const headerBg = "#03577B";
  const headerColor = "#FFFFFF";

  // 1. Teams tab
  let teamsSheet = ss.getSheetByName("Teams");
  if (!teamsSheet) teamsSheet = ss.insertSheet("Teams");
  teamsSheet.clear();
  const teamsData = [
    ["Team No", "Captain Name", "Code", "Allocated Category"],
    [1, "Aarav Sharma", "4821", ""],
    [2, "Diya Patel", "7394", ""],
    [3, "Rohan Verma", "2158", ""],
    [4, "Ananya Iyer", "6043", ""],
    [5, "Kabir Mehta", "9512", ""],
    [6, "Priya Nair", "3876", ""],
    [7, "Siddharth Rao", "1429", ""],
    [8, "Tanya Kapoor", "8265", ""]
  ];
  teamsSheet.getRange(1, 1, teamsData.length, 4).setValues(teamsData);
  formatHeader(teamsSheet.getRange(1, 1, 1, 4), headerBg, headerColor);

  // 2. Categories tab
  let catSheet = ss.getSheetByName("Categories");
  if (!catSheet) catSheet = ss.insertSheet("Categories");
  catSheet.clear();
  const catData = [
    ["Category"],
    ["FMCG Snacks"],
    ["Sustainable Fashion"],
    ["FinTech App"],
    ["Personal Care"],
    ["EV Mobility"],
    ["EdTech"],
    ["Café Brand"],
    ["Smart Home"]
  ];
  catSheet.getRange(1, 1, catData.length, 1).setValues(catData);
  formatHeader(catSheet.getRange(1, 1, 1, 1), headerBg, headerColor);

  // 3. Allocations tab
  let allocSheet = ss.getSheetByName("Allocations");
  if (!allocSheet) allocSheet = ss.insertSheet("Allocations");
  allocSheet.clear();
  allocSheet.getRange(1, 1, 1, 3).setValues([["Timestamp", "Team No", "Category"]]);
  formatHeader(allocSheet.getRange(1, 1, 1, 3), headerBg, headerColor);

  // 4. Attempts tab
  let attSheet = ss.getSheetByName("Attempts");
  if (!attSheet) attSheet = ss.insertSheet("Attempts");
  attSheet.clear();
  attSheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Team No", "Name Entered", "Result"]]);
  formatHeader(attSheet.getRange(1, 1, 1, 4), headerBg, headerColor);

  // Remove default "Sheet1" if it exists and is not one of our tabs
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  return "Sheet initialized successfully with 4 tabs, styling, and initial data.";
}

function formatHeader(range, bg, color) {
  range.setBackground(bg)
       .setFontColor(color)
       .setFontWeight("bold")
       .setHorizontalAlignment("center");
}

function checkLocked(ss, teamNo) {
  const attSheet = ss.getSheetByName("Attempts");
  if (!attSheet || attSheet.getLastRow() < 2) return false;
  const data = attSheet.getRange(2, 2, attSheet.getLastRow() - 1, 3).getValues();
  let failCount = 0;
  for (let i = 0; i < data.length; i++) {
    const rowTeam = data[i][0];
    const result = data[i][2];
    if (String(rowTeam).trim() === String(teamNo).trim()) {
      if (result === "FAILED") {
        failCount++;
      } else if (result === "SUCCESS") {
        // Reset count if successfully logged in earlier, or keep global?
        // Standard rule: after 5 failed attempts for a team number, lock it.
      }
    }
  }
  return failCount >= 5;
}

function validateCredentials(ss, teamNo, name, code) {
  const teamsSheet = ss.getSheetByName("Teams");
  if (!teamsSheet || teamsSheet.getLastRow() < 2) return false;
  const data = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 3).getValues();
  const cleanName = String(name || "").trim().toLowerCase();
  const cleanCode = String(code || "").trim();

  for (let i = 0; i < data.length; i++) {
    const rowTeam = String(data[i][0]).trim();
    const rowCaptain = String(data[i][1]).trim().toLowerCase();
    const rowCode = String(data[i][2]).trim();

    if (rowTeam === String(teamNo).trim()) {
      if (rowCaptain === cleanName && rowCode === cleanCode) {
        return true;
      }
      return false;
    }
  }
  return false;
}

function logAttempt(ss, teamNo, name, result) {
  const attSheet = ss.getSheetByName("Attempts");
  if (attSheet) {
    attSheet.appendRow([new Date(), teamNo, name, result]);
  }
}

function getAllocations(ss) {
  const allocSheet = ss.getSheetByName("Allocations");
  if (!allocSheet || allocSheet.getLastRow() < 2) return [];
  return allocSheet.getRange(2, 1, allocSheet.getLastRow() - 1, 3).getValues();
}

function getAllCategories(ss) {
  const catSheet = ss.getSheetByName("Categories");
  if (!catSheet || catSheet.getLastRow() < 2) return [];
  const rows = catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 1).getValues();
  return rows.map(r => String(r[0]).trim()).filter(Boolean);
}

function handleLogin(team, name, code) {
  const ss = getSpreadsheet();
  team = String(team).trim();

  if (checkLocked(ss, team)) {
    logAttempt(ss, team, name, "LOCKED");
    return { success: false, status: "locked", error: "This team has been locked due to 5 failed attempts." };
  }

  const isValid = validateCredentials(ss, team, name, code);
  if (!isValid) {
    logAttempt(ss, team, name, "FAILED");
    const nowLocked = checkLocked(ss, team);
    if (nowLocked) {
      return { success: false, status: "locked", error: "Too many failed attempts. This team is now locked." };
    }
    return { success: false, status: "invalid", error: "Incorrect captain name or 4-digit code." };
  }

  logAttempt(ss, team, name, "SUCCESS");
  return { success: true, status: "ok", team: Number(team) };
}

function handleStatus(team, name, code) {
  const ss = getSpreadsheet();
  team = String(team).trim();

  if (checkLocked(ss, team)) {
    return { success: false, status: "locked", error: "Team is locked." };
  }
  if (!validateCredentials(ss, team, name, code)) {
    return { success: false, status: "unauthorized", error: "Unauthorized." };
  }

  const allCats = getAllCategories(ss);
  const allocations = getAllocations(ss);

  let teamCategory = null;
  const takenCats = new Set();
  allocations.forEach(row => {
    const rowTeam = String(row[1]).trim();
    const rowCat = String(row[2]).trim();
    takenCats.add(rowCat);
    if (rowTeam === team) {
      teamCategory = rowCat;
    }
  });

  const remainingCats = allCats.filter(c => !takenCats.has(c));

  return {
    success: true,
    allocated: teamCategory,
    remaining: remainingCats,
    allCategories: allCats
  };
}

function handleSpin(team, name, code) {
  const lock = LockService.getScriptLock();
  try {
    const acquired = lock.tryLock(10000);
    if (!acquired) {
      return { success: false, error: "Server busy. Please try spinning again in a moment." };
    }

    const ss = getSpreadsheet();
    team = String(team).trim();

    if (checkLocked(ss, team)) {
      return { success: false, status: "locked", error: "Team is locked." };
    }
    if (!validateCredentials(ss, team, name, code)) {
      return { success: false, status: "unauthorized", error: "Unauthorized." };
    }

    const allocations = getAllocations(ss);
    // Check if team already has an allocation
    for (let i = 0; i < allocations.length; i++) {
      if (String(allocations[i][1]).trim() === team) {
        return {
          success: true,
          category: String(allocations[i][2]).trim(),
          alreadySpun: true
        };
      }
    }

    const allCats = getAllCategories(ss);
    const takenCats = new Set(allocations.map(r => String(r[2]).trim()));
    const remainingCats = allCats.filter(c => !takenCats.has(c));

    if (remainingCats.length === 0) {
      return { success: false, error: "No categories left to spin!" };
    }

    const randomIndex = Math.floor(Math.random() * remainingCats.length);
    const chosenCategory = remainingCats[randomIndex];

    const allocSheet = ss.getSheetByName("Allocations");
    allocSheet.appendRow([new Date(), Number(team), chosenCategory]);

    // Also update the Allocated Category column directly in the Teams sheet
    const teamsSheet = ss.getSheetByName("Teams");
    if (teamsSheet && teamsSheet.getLastRow() > 1) {
      const tData = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 1).getValues();
      for (let r = 0; r < tData.length; r++) {
        if (String(tData[r][0]).trim() === team) {
          teamsSheet.getRange(r + 2, 4).setValue(chosenCategory);
          break;
        }
      }
    }

    return {
      success: true,
      category: chosenCategory,
      alreadySpun: false
    };
  } finally {
    lock.releaseLock();
  }
}

function resetAllocations() {
  const ss = getSpreadsheet();
  const allocSheet = ss.getSheetByName("Allocations");
  if (allocSheet && allocSheet.getLastRow() > 1) {
    allocSheet.getRange(2, 1, allocSheet.getLastRow() - 1, allocSheet.getLastColumn()).clearContent();
  }
  const attSheet = ss.getSheetByName("Attempts");
  if (attSheet && attSheet.getLastRow() > 1) {
    attSheet.getRange(2, 1, attSheet.getLastRow() - 1, attSheet.getLastColumn()).clearContent();
  }
  const teamsSheet = ss.getSheetByName("Teams");
  if (teamsSheet && teamsSheet.getLastRow() > 1) {
    teamsSheet.getRange(2, 4, teamsSheet.getLastRow() - 1, 1).clearContent();
  }
  return "Allocations and Attempts have been cleared.";
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = e ? e.parameter : {};
  const action = params.action;
  const team = params.team;
  const name = params.name;
  const code = params.code;

  if (action === "init") {
    return jsonResponse({ message: initSheet() });
  }
  if (action === "status") {
    return jsonResponse(handleStatus(team, name, code));
  }
  if (action === "login") {
    return jsonResponse(handleLogin(team, name, code));
  }
  if (action === "spin") {
    return jsonResponse(handleSpin(team, name, code));
  }
  if (action === "reset") {
    return jsonResponse({ message: resetAllocations() });
  }

  return jsonResponse({ error: "Invalid action" });
}

function doPost(e) {
  let params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = e.parameter || {};
    }
  } else if (e && e.parameter) {
    params = e.parameter;
  }

  const action = params.action;
  const team = params.team;
  const name = params.name;
  const code = params.code;

  if (action === "login") {
    return jsonResponse(handleLogin(team, name, code));
  }
  if (action === "status") {
    return jsonResponse(handleStatus(team, name, code));
  }
  if (action === "spin") {
    return jsonResponse(handleSpin(team, name, code));
  }
  if (action === "reset") {
    return jsonResponse({ message: resetAllocations() });
  }
  if (action === "init") {
    return jsonResponse({ message: initSheet() });
  }

  return jsonResponse({ error: "Invalid POST action" });
}
