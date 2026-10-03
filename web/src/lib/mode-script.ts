/** Runs before paint so /app opens in the saved mode without a flash. Keep the key in sync with mode.ts. */
export const modeScript = `try{if(location.pathname.indexOf("/app")===0&&localStorage.getItem("toki.mode")==="time")document.documentElement.dataset.mode="time"}catch(e){}`;
