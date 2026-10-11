import app from "./app";
import { logger } from "./lib/logger";
import { getConfig, isProduction } from "./config/env";

const config = getConfig();
const port = Number(config.PORT);

app.listen(port, () => {
  logger.info(
    { port, env: config.NODE_ENV, openai: !!config.OPENAI_API_KEY },
    `Server listening on port ${port} (${config.NODE_ENV})`,
  );
});
