import app from "./app";

const initializeServer = async () => {

  await app.listen({
        host: "0.0.0.0",
        port: 3333,
      }).catch((err: any) => {
        console.error("Erro ao iniciar servidor:", err);
        process.exit(1);
      });
  };

initializeServer();
