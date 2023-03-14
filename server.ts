import conf from "./config/config";
import initRouter from "./router/router";

async function init() {
    const PORT = process.env.PORT || conf.app.port;
    const app = await initRouter(conf)
    app.listen(PORT, () => console.log(`Server is listening on port http://localhost:${PORT}`));
}

init()