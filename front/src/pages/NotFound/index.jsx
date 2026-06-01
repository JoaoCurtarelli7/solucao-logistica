import React from "react";
import { Result, Button } from "antd";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7fa" }}>
      <Result
        status="404"
        title="404"
        subTitle="Página não encontrada."
        extra={<Button type="primary" onClick={() => navigate("/")}>Voltar ao início</Button>}
      />
    </div>
  );
}
