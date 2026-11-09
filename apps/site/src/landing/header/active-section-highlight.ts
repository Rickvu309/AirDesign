const activeSectionBand = "-45% 0px -50% 0px";
const pillMoveMs = 280;

function sectionIdOf(link: HTMLAnchorElement): string {
  return link.hash.slice(1);
}

function markActive(links: HTMLAnchorElement[], activeLink: HTMLAnchorElement): void {
  links.forEach((link) => {
    const isActive = link === activeLink;
    link.toggleAttribute("data-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function lockTabWidths(links: HTMLAnchorElement[], activeLink: HTMLAnchorElement): void {
  links.forEach((link) => link.toggleAttribute("data-active", true));
  const widths = links.map((link) => link.offsetWidth);
  links.forEach((link, index) => {
    link.style.width = `${widths[index]}px`;
  });
  markActive(links, activeLink);
}

function placePill(pill: HTMLElement, activeLink: HTMLAnchorElement, moveEasing: string | null): void {
  const from = pill.getBoundingClientRect();
  pill.getAnimations().forEach((animation) => animation.cancel());
  pill.style.left = `${activeLink.offsetLeft}px`;
  pill.style.width = `${activeLink.offsetWidth}px`;
  if (moveEasing === null || from.width === 0) {
    return;
  }
  const to = pill.getBoundingClientRect();
  pill.animate(
    [
      { transform: `translateX(${from.left - to.left}px) scaleX(${from.width / to.width})` },
      { transform: "translateX(0) scaleX(1)" },
    ],
    { duration: pillMoveMs, easing: moveEasing },
  );
}

export async function highlightActiveSection(tabs: HTMLElement): Promise<void> {
  const links = Array.from(tabs.querySelectorAll<HTMLAnchorElement>("[data-nav-tab]"));
  const pill = tabs.querySelector<HTMLElement>("[data-nav-pill]");
  const firstLink = links[0];
  if (!pill || !firstLink) {
    return;
  }

  const showsMotion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const moveEasing = getComputedStyle(document.documentElement).getPropertyValue("--ease-panel").trim();

  await document.fonts.ready;

  let activeLink = firstLink;
  if (showsMotion) {
    lockTabWidths(links, activeLink);
    placePill(pill, activeLink, null);
    tabs.toggleAttribute("data-pill-ready", true);
    new ResizeObserver(() => placePill(pill, activeLink, null)).observe(tabs);
  }

  const sectionsInBand = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          sectionsInBand.add(entry.target.id);
        } else {
          sectionsInBand.delete(entry.target.id);
        }
      });
      const nextLink = links.findLast((link) => sectionsInBand.has(sectionIdOf(link))) ?? firstLink;
      if (nextLink === activeLink) {
        return;
      }
      activeLink = nextLink;
      markActive(links, activeLink);
      if (showsMotion) {
        placePill(pill, activeLink, moveEasing);
      }
    },
    { rootMargin: activeSectionBand },
  );

  links.forEach((link) => {
    const section = document.getElementById(sectionIdOf(link));
    if (section) {
      observer.observe(section);
    }
  });
}
