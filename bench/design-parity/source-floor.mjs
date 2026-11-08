export const fixedMargin=0.01
export const maximumSourceFloor=0.9
export function sourceTarget(score){
  if(!Number.isFinite(score)||score<0||score>=maximumSourceFloor)throw new Error("unusable-source-floor")
  return score+fixedMargin
}
export function validateSourceFloor(row){
  if(row.status==="uncalibrated"){
    if(row.floor!==null||row.target!==null||!row.reason)throw new Error("invalid-uncalibrated-floor")
    return
  }
  if(row.status!=="calibrated"||!Number.isFinite(row.floor)||row.floor<0||row.floor>=maximumSourceFloor||row.target!==sourceTarget(row.floor)||!row.repeatIdentical||row.captureSha256!==row.repeatSha256)throw new Error("invalid-source-floor")
}
export function sourceVerdict(row,score){
  validateSourceFloor(row)
  return row.status==="uncalibrated" ? "uncalibrated" : Number.isFinite(score)&&score<=row.target ? "pass" : "fail"
}
