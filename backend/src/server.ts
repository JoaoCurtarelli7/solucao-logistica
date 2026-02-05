import console from "console";
import app from "./app";

const initializeServer = async () => {
  const port = Number(process.env.PORT) || 3333
  await app.listen({
        host: "0.0.0.0",
        port: port,
      }).catch((err: any) => {
        console.error("Erro ao iniciar servidor:", err);
        process.exit(1);
      });
  };

initializeServer();
