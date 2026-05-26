"use client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Box } from "@mui/material";

function Layout({ children }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", bgcolor: "background.default", minHeight: "100vh" }}>
      <Header />
      <Box
        sx={{
          width: "100%",
          bgcolor: "background.default",
          mt: "64px",
          flex: 1,
        }}
      >
        {children}
      </Box>
      <Footer />
    </Box>
  );
}

export default Layout;
