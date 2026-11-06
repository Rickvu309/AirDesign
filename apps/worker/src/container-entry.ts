const supervisor=Number(process.argv[3])
const checkSupervisor=()=>{if(!Number.isSafeInteger(supervisor)||supervisor<=1||process.ppid!==supervisor)process.kill(-process.pid,"SIGKILL")}
checkSupervisor()
const guard=setInterval(checkSupervisor,100)
guard.unref()
let command=""
for await(const chunk of process.stdin)command+=chunk.toString()
if(command!=="start")process.exit(1)
checkSupervisor()
const program=process.argv[2]
if(!program)throw new Error("missing-job-program")
await import(program)

export {}
