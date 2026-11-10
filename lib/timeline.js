export function firstTimelineValue(indicator, fromYear, toYear) {
  return (indicator.values || []).filter(item =>
    Number(item.year) >= fromYear && Number(item.year) <= toYear &&
    item.value !== null && item.value !== undefined && String(item.value).trim() !== '' && Number.isFinite(Number(item.value))
  ).sort((a, b) => Number(a.year) - Number(b.year))[0] || null;
}

export function canComparePercent(indicators, fromYear, toYear) {
  return indicators.length > 0 && indicators.every(indicator => {
    const baseline = firstTimelineValue(indicator, fromYear, toYear);
    return baseline && Number(baseline.value) !== 0;
  });
}

export function timelineRows(indicators, fromYear, toYear, mode = 'actual') {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || toYear < fromYear || toYear - fromYear > 1000) return [];
  return Array.from({length: toYear - fromYear + 1}, (_, index) => {
    const year = fromYear + index;
    const row = {year};
    for (const indicator of indicators) {
      const value = indicator.values.find(item => Number(item.year) === year);
      if (!value || value.value === null || value.value === undefined || String(value.value).trim() === '' || !Number.isFinite(Number(value.value))) {
        row[indicator.id] = null;
        continue;
      }
      const baseline = firstTimelineValue(indicator, fromYear, toYear);
      row[indicator.id] = mode === 'percent'
        ? baseline && Number(baseline.value) !== 0 ? ((Number(value.value) - Number(baseline.value)) / Math.abs(Number(baseline.value))) * 100 : null
        : Number(value.value);
    }
    return row;
  });
}

// What the timeline page sends per indicator. The full indicator carries every value's source,
// notes and status (about 7 MB for the page); the chart, table, CSV and image export only read
// the year and value of each point, the name, unit and one source name. Order is kept, since
// timelineRows takes the first point of each year.
export function timelineIndicator(indicator) {
  return {
    id: indicator.id,
    name: indicator.name,
    unit: indicator.unit,
    source: indicator.adopted_source?.name || indicator.latestValue?.source?.name || '',
    values: (indicator.values || []).map(({year, value}) => ({year, value})),
  };
}
