export const PRACTICE_DURATIONS=[10,15,20,30];
export const DAILY_DURATION=7;
export function roundDuration(mode,selection=15){return mode==='daily'?DAILY_DURATION:PRACTICE_DURATIONS.includes(selection)?selection:15;}
export function millisecondsRemaining(deadline,now){return Math.max(0,deadline-now);}
export function secondsRemaining(deadline,now){return Math.ceil(millisecondsRemaining(deadline,now)/1000);}

// A question start time from the server, moved onto this device's clock. A phone whose clock
// runs a few seconds fast or slow would otherwise lose or gain time on every official question.
export function localStartTime(startedAt,serverNow){
 const start=Date.parse(startedAt),server=Date.parse(serverNow);
 if(!Number.isFinite(start))return null;
 return Number.isFinite(server)?new Date(start+(Date.now()-server)).toISOString():new Date(start).toISOString();
}
