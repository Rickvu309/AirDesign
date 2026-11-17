import name from "./sign-up-name.mjs"

export default {
  name: "sign-up-name-phone",
  design: "/screens/s01-01-sign-up-name",
  async drive(kit) {
    await kit.page.setViewportSize({ width: 390, height: 844 })
    await name.drive(kit)
  },
}
