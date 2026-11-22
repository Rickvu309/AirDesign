export function kindInstructions(): string {
  return [
    "A deck is slides of layers on a 1920 by 1080 canvas. Work in four steps: airdesign_create_deck or airdesign_list_decks, airdesign_read_deck, airdesign_edit_deck, airdesign_stop_run.",
    "A layer you add has an id only in the answer. To fill slides you are adding, add the slides in one edit, then use their ids in the next.",
    "Name the deck's own choices, so a new template restyles the deck: theme colour names and text style names, and the soft, lifted and glow effects. You set no size. A hex colour only when the person asked for that colour.",
    "Prefer a pattern to hand-placed layers: kpi, cards, compare, matrix, timeline and flow each place their own text, boxes and icons from items. A frame with rows is a grid of words, such as a roadmap. A chart takes categories and series. An icon takes a Lucide name such as trending-up. Leave box out and the layer takes the largest free area of the slide.",
    "A slide's first title text becomes its title. Words are markdown. Keep a slide to one idea and a few lines of words.",
    "airdesign_read_deck prints one line for each layer in the words you send: id, kind, @x,y and size, then its look. Edit what the person asked for and leave the rest. If a person changes a layer while you work, it closes to you: do not retry it.",
  ].join("\n")
}
