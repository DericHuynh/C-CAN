/// <reference types="vite/client" />

declare module "virtual:react-router/server-build" {
  const build: import("react-router").ServerBuild;
  export = build;
}

declare module "react-dom/server.browser" {
  export * from "react-dom/server";
  export { default } from "react-dom/server";
}
