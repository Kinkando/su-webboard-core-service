import conf from "./config/config";
import initRouter from "./router/router";
import logger from "./util/logger";

async function init() {
    const PORT = process.env.PORT || conf.app.port;
    const app = await initRouter(conf)
    app.listen(PORT, () => logger.debug(`Server is listening on port :${PORT}`));
}

init()