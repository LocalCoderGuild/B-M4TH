import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

const PIXEL_FONT_STACK =
  "\"Press Start 2P\", \"Silkscreen\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "xs",
  fontFamily: PIXEL_FONT_STACK,
  fontFamilyMonospace: PIXEL_FONT_STACK,
  headings: { fontFamily: PIXEL_FONT_STACK },
  colors: {
    dark: [
      "#f3ecd3",
      "#d8d0ba",
      "#aaa38d",
      "#7d7667",
      "#4d5360",
      "#303746",
      "#232a38",
      "#171d2b",
      "#101522",
      "#070a12",
    ],
  },
});

function Root() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark" forceColorScheme="dark">
      <Notifications position="top-right" />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
