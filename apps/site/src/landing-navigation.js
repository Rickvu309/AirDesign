const links = [...document.querySelectorAll(".nav-segments a")]
const headings = [document.querySelector("#agents"), document.querySelector("#pricing")]

function updateNavigation() {
  const threshold = Math.max(document.querySelector(".landing-page header").getBoundingClientRect().bottom + 60, window.innerHeight / 2)
  let active = 0
  for (const [index, heading] of headings.entries()) {
    if (heading.getBoundingClientRect().top <= threshold) active = index + 1
  }
  for (const [index, link] of links.entries()) {
    if (index === active) link.setAttribute("aria-current", "location")
    else link.removeAttribute("aria-current")
  }
}

window.addEventListener("scroll", updateNavigation, {passive: true})
window.addEventListener("resize", updateNavigation)
updateNavigation()
