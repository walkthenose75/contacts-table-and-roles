import { createBrowserRouter, Navigate } from "react-router-dom"
import Layout from "@/pages/_layout"
import ContactsPage from "@/pages/contacts"
import ContactDetailPage from "@/pages/contact-detail"
import WebRolesPage from "@/pages/web-roles"
import NotFoundPage from "@/pages/not-found"

// IMPORTANT: Do not remove or modify the code below!
// Normalize basename when hosted in Power Apps
const BASENAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Navigate to="/contacts" replace /> },
      { path: "contacts", element: <ContactsPage /> },
      { path: "contacts/:id", element: <ContactDetailPage /> },
      { path: "web-roles", element: <WebRolesPage /> },
    ],
  },
], { 
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})