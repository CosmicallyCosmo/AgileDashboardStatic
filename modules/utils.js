"use strict";

var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

export function escapeHtml(string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return entityMap[s];
  });
}

export function validateInt(string, min, max) {
    const parsed_int = parseInt(string);
    if  (min <= parsed_int && parsed_int <= max) {
        return parsed_int;
    }
    return -1;
};

export function normalize(value, min, max) {
    return (value - min) / (max - min);
}

export function getJetColor(value) {
    const normValue = Math.max(0, Math.min(1, value)); // Ensure it's clamped between 0 and 1
    var colorScale = d3.scaleSequential(d3.interpolateTurbo);
    return colorScale(normValue);
}

export function setCookie(cname, cvalue, exdays) {
    new CookiesEuBanner(function () {
        const d = new Date();
        d.setTime(d.getTime() + (exdays*24*60*60*1000));
        let expires = "expires="+ d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    })
  }

export function getCookie(cname, def) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
        c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
        }
    }
    return def;
}

export function minMovingAverage(unit, intervals) {
    // if (n > prices.length) return null; // not enough data

    // Sum of first block
    let currentSum = 0;
    for (let i = 0; i < intervals; i++) {
        currentSum += unit[i];
    }

    let minSum = currentSum;
    let minIndex = 0;

    // Slide the window
    for (let i = intervals; i < unit.length; i++) {
        currentSum = currentSum - unit[i - intervals] + unit[i];
        if (currentSum < minSum) {
            minSum = currentSum;
            minIndex = i - intervals + 1;
        }
    }

return {
        startIndex: minIndex,
        sum: minSum,
    };
};

export function toLondonISOString(utcDate) {
  // Convert to a Date in London time and output ISO string (still works in Plotly)
  return new Date(
    utcDate.toLocaleString("en-US", { timeZone: "Europe/London" })
  );
};

export function getLondonTimeParts(utcIsoString) {
  const utcDate = new Date(utcIsoString);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  // This returns something like "13:00"
  const timeString = formatter.format(utcDate);

  const [hour, minute] = timeString.split(":").map(Number);
  return { hour, minute };
};

export function londonDayToUtcRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const startUtc = new Date(
    new Date(Date.UTC(year, month, day, 0, 0, 0))
      .toLocaleString("en-GB", { timeZone: "Europe/London" })
  );

  const endUtc = new Date(
    new Date(Date.UTC(year, month, day + 1, 0, 0, 0))
      .toLocaleString("en-GB", { timeZone: "Europe/London" })
  );

  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString()
  };
}