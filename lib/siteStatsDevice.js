// Browser flags for «إحصاءات الموقع». The team's devices are left out of the numbers: the flag is
// set when an editor or manager signs in on this browser (components/editorFlag.js) and stays after
// signing out. A manager can also set or clear it from the statistics page.
const TEAM_KEY='967-analytics-team';
export const OPT_OUT_KEY='967-analytics-opt-out';
export function markTeamDevice(){try{localStorage.setItem(TEAM_KEY,'1');}catch{/* storage blocked */}}
export function clearTeamDevice(){try{localStorage.removeItem(TEAM_KEY);}catch{/* storage blocked */}}
export function isTeamDevice(){try{return localStorage.getItem(TEAM_KEY)==='1';}catch{return false;}}
