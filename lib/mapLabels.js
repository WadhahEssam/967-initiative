// Labels that fit at the current zoom: a label that would overlap a more important one is left
// out (its region keeps its title and stays searchable) and appears as the reader zooms in.
// Pinned labels (selected, hovered) always show; then the important ones (main cities); then larger regions. Boxes are in map
// units: text is centred (text-anchor: middle) on the region's centre, drawn above the baseline.
const regionArea = item => item.bounds ? (item.bounds[2] - item.bounds[0]) * (item.bounds[3] - item.bounds[1]) : 0;
export function visibleLabelIds(items, {sizeOf, pinned = [], important = []} = {}) {
  const isPinned = item => pinned.includes(item.id), isImportant = item => important.includes(item.id);
  const order = [...items].sort((a, b) => (isPinned(b) - isPinned(a)) || (isImportant(b) - isImportant(a)) || (regionArea(b) - regionArea(a)));
  const placed = [], shown = new Set();
  for (const item of order) {
    if (!item?.center) continue;
    const size = sizeOf(item), x = item.center[0], y = -item.center[1];
    const width = Math.max(1, [...String(item.nameAr || '')].length) * size * 0.56 + size * 0.5, height = size * 1.3;
    const box = {left: x - width / 2, right: x + width / 2, top: y - height * 0.8, bottom: y + height * 0.3};
    if (!isPinned(item) && placed.some(p => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top)) continue;
    placed.push(box); shown.add(item.id);
  }
  return shown;
}
