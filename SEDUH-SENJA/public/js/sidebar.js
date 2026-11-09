document.addEventListener("DOMContentLoaded", () => {

    const currentPath =
        window.location.pathname.replace(/\/+$/, "") || "/";

    const sidebarLinks =
        document.querySelectorAll(".sidebar a[href]");

    sidebarLinks.forEach(link => {

        const href = link.getAttribute("href");

        if (!href || href === "#") {
            link.classList.remove("active");
            return;
        }

        const linkPath = new URL(
            href,
            window.location.origin
        ).pathname.replace(/\/+$/, "") || "/";

        link.classList.toggle(
            "active",
            linkPath === currentPath
        );
    });

});