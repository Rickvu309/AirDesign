# Components

409 components. Import from `@airdesign/ui`; load `@airdesign/ui/tokens.css` (design tokens) and `@airdesign/ui/base.css` (minimal reset; skip it if your app already has a Tailwind-style preflight) once.

## Tokens

| Token | Default | Use |
|---|---|---|
| `--ad-ink` | `rgba(0, 0, 0, 0.898)` | Primary text and icons |
| `--ad-ink-strong` | `rgb(0, 0, 0)` | Highest-contrast text |
| `--ad-ink-muted` | `rgba(0, 0, 0, 0.5)` | Secondary text and icons |
| `--ad-ink-subtle` | `rgba(0, 0, 0, 0.3)` | Disabled and placeholder |
| `--ad-border` | `rgba(0, 0, 0, 0.1)` | Default border |
| `--ad-border-strong` | `rgba(0, 0, 0, 0.15)` | Emphasised border |
| `--ad-divider` | `rgb(230, 230, 230)` | Dividers and raised neutral fills |
| `--ad-divider-strong` | `rgb(217, 217, 217)` | Strong neutral stroke |
| `--ad-surface` | `rgb(255, 255, 255)` | Panels and cards |
| `--ad-surface-subtle` | `rgb(245, 245, 245)` | Hover and secondary surfaces |
| `--ad-brand` | `rgb(255, 92, 22)` | Brand orange |
| `--ad-brand-strong` | `rgb(226, 76, 12)` | Brand orange, pressed and icons |
| `--ad-brand-subtle` | `rgb(255, 223, 204)` | Brand tint |
| `--ad-accent` | `rgb(61, 56, 245)` | Accent blue-violet (shapes, focus) |
| `--ad-accent-strong` | `rgb(43, 39, 172)` | Accent outline |
| `--ad-selection` | `rgb(13, 153, 255)` | Selection blue |
| `--ad-selection-strong` | `rgb(0, 123, 229)` | Selection blue, pressed |
| `--ad-selection-subtle` | `rgb(242, 249, 255)` | Selection tint |
| `--ad-pink` | `#FF58AE` | Brand mark stroke |
| `--ad-folder` | `rgb(175, 188, 207)` | Folder icons |
| `--ad-icon` | `var(--ad-ink)` | Default icon fill |

## brand (1)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `AirDesignLogo` | Logo | `html-i_r0TvKy21HanTT8agy2z` |

## cards (10)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `PresentationFileCard` | 00-Home | `html-YPpEQGJ3VVToNHTfdHwnI` |
| `EmptyPresentationFileCard` | 00-Home | `html-wLSGaPq9XbTUffI-0K83a` |
| `PresentationPrompt` | 01-Getting-started | `html-DFiPCdn01ZepX93Ie3W3X` |
| `CreatePresentationOptions` | 01-Getting-started | `html-LZkw3uaDdmLvQQ-YD9vkV` |
| `StartFromScratchCard` | 01-Getting-started | `html-GPDTzQNCGQrY7tvbvwfpc` |
| `UseTemplateCard` | 01-Getting-started | `html-E_xhXUa9abSj7L6nkrXvq` |
| `AgentSuggestions` | AgentsPanel | `html-Gs1lfObDTjm_vk9Acgov0` |
| `AgentComposer` | AgentsPanel | `html-nWIsetUPuEU1gKC9mo71J` |
| `SlideThumbnail` | FilePanel | `html-i0NgWSHlSGJUgET9biXIm` |
| `MediaImageGrid` | MediaPanel | `html-uXf2S4T3bbvadYn09dBzj` |

## controls (204)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `AccountMenuButton` | 00-Home | `html-4MpjZUR9zOM4xQ0UO89Ph` |
| `HomeProfileAvatar` | 00-Home | `html-CB-tAhLLUnc--Fn8vSkE4` |
| `NotificationsButton` | 00-Home | `html-_QAL0fono_PzCzTs6WheF` |
| `SearchInput` | 00-Home | `html-oZGTAv6HGmC5zYnQjWTWv` |
| `RecentsButton` | 00-Home | `html-40usFLRxw2iA404AfXV1-` |
| `PlanButton` | 00-Home | `html-5uH5x7Lqxu5uyfFfT8JHS` |
| `HomeProfileAvatar2` | 00-Home | `html-aP0gj5O8Wo6P2-xXsawRr` |
| `ChangePlanButton` | 00-Home | `html-M_1SEcomGCMMYHiGY6Un0` |
| `AllFoldersButton` | 00-Home | `html-CtT6cRhna-P9WFgnGLGnr` |
| `ResourcesButton` | 00-Home | `html-nOV-LHLGVRleQzCPegRnw` |
| `TrashButton` | 00-Home | `html-gO05wWWyeNCtlrbTrY6lN` |
| `AdminButton` | 00-Home | `html-KNN03803bTHMdGhM7pqQm` |
| `AdminNotificationsBadge` | 00-Home | `html-yKcpWtC0W7cfMN1W4ZjY7` |
| `StarredButton` | 00-Home | `html-XnV3KgOgnTHt4JG7Pw3A4` |
| `PersonalProjectButton` | 00-Home | `html-ZpEPIqrd1JO2zgpPy8NuA` |
| `WorkProjectButton` | 00-Home | `html-PbxqITHnenQFIvdxz7r3O` |
| `CollabProjectButton` | 00-Home | `html-F4RRIkKuTKcya55JgxMnT` |
| `ArchiveProjectButton` | 00-Home | `html-qP-Yk9RJsLxkRXKay9Shg` |
| `RecentFileButtonNovaMembership` | 00-Home | `html-ygt7lsw53B8qiSvWj2fVb` |
| `RecentFileButtonProjectConsulting` | 00-Home | `html-7fraXJQGMRFOQp7tPc9Z2` |
| `RecentFileButtonProfessionalTemplate` | 00-Home | `html-3X_fBSaY82CnmE3eGfB-9` |
| `RecentFileButtonVietjetProject` | 00-Home | `html-IYjaWomehQl9ecFAv81Hz` |
| `RecentFileButtonGrokBotSlide` | 00-Home | `html-ljEC2GDAGFgzcrvBaOxay` |
| `NewDesignFileButton` | 00-Home | `html-nDDyIMvY3apmkFdoVjTZB` |
| `NewSlidesFileButton` | 00-Home | `html-5cAmk4qTvmIlQQ16bfFRb` |
| `MoreButton` | 00-Home | `html-vRENJwr6ZgQFIK2Yi6Cao` |
| `AccountButton` | 00-Home | `html-1NeXzzbKiZ7hXcpwwDsRX` |
| `HomeHelpButton` | 00-Home | `html-g0r8QzAurPeNe5pq41HxN` |
| `GettingStartedMoveButton` | 01-Getting-started | `html-pU5g5xD6k5fkLd0S958zn` |
| `GettingStartedMoveToolsButton` | 01-Getting-started | `html-Z9oYGjpp7hj0Rnio8gaTU` |
| `GettingStartedTextButton` | 01-Getting-started | `html-yQ80LSrE7ngS-v-D4hWxH` |
| `GettingStartedImageVideoButton` | 01-Getting-started | `html-STgP3HR0DLIbL0POTiMiH` |
| `GettingStartedShapesButton` | 01-Getting-started | `html-6v-UMCpIHm7Q0O51uKQ4D` |
| `GettingStartedCommentButton` | 01-Getting-started | `html-BO-mQtPhXe0JLyQ3JjMR7` |
| `GettingStartedActionsButton` | 01-Getting-started | `html-hWteR4E8bBkK-LKWFURJR` |
| `GettingStartedMoveButton2` | 01-Getting-started | `html-P2sbmL9P911RwZthG2otd` |
| `GettingStartedMoveToolsButton2` | 01-Getting-started | `html-kVZIyydLYwaKlK2ksAyZQ` |
| `GettingStartedFrameButton` | 01-Getting-started | `html-Hpk1SF1hUundhCIT_LDJO` |
| `GettingStartedRectangleButton` | 01-Getting-started | `html-XQA7D07Tykry7X8eLE7RI` |
| `GettingStartedShapeToolsButton` | 01-Getting-started | `html-4FaJ8RcZ4Lx9673ytDyf-` |
| `GettingStartedPenButton` | 01-Getting-started | `html-GWKTryrHfLIF-72SpK5O5` |
| `GettingStartedCreationToolsButton` | 01-Getting-started | `html-qcp52f-6ZBoM1DVsaHeTL` |
| `GettingStartedTextButton2` | 01-Getting-started | `html-qbiCDFQJl6WnDevNqG1Is` |
| `GettingStartedTypeToolsButton` | 01-Getting-started | `html-DLF0b8czwzS3A4mt3VrXZ` |
| `GettingStartedCommentButton2` | 01-Getting-started | `html-7l8iy5Oi6yoepnE_1ODgR` |
| `GettingStartedActionsButton2` | 01-Getting-started | `html-ZjekhXYfzhG0sMQ2Tx2md` |
| `GettingStartedAssetsButton` | 01-Getting-started | `html-3Eu4_zaQ4weXxyjmV6r8W` |
| `GettingStartedMainMenuButton` | 01-Getting-started | `html-3plIeyuyBwq1agEo7vK0I` |
| `GettingStartedFileButton` | 01-Getting-started | `html-QoE1v5LlCIJdJ0QRa7a-n` |
| `GettingStartedAgentsButton` | 01-Getting-started | `html-MAq1ZaDgOdIEFniKlpO11` |
| `GettingStartedInsertsButton` | 01-Getting-started | `html-klTIJPnPv9oYV7CL-avSG` |
| `FileNameButton` | 01-Getting-started | `html-CtSdTkI01N6f2NU1SBGwD` |
| `GettingStartedEditFileMenuButton` | 01-Getting-started | `html-XmcupQ4DE5kJJMEiDArxd` |
| `GettingStartedGridViewButton` | 01-Getting-started | `html-3eYpfIuX261mWxRFJFr_z` |
| `GettingStartedNewSlideButton` | 01-Getting-started | `html-HPt051ivw9c8-8b0N_gRK` |
| `GettingStartedAddBlankSlideButton` | 01-Getting-started | `html-HuofJxVBgdxfeEXrzR4Z8` |
| `GettingStartedCloseButton` | 01-Getting-started | `html-pGd37eGNVM0-RuvzS30vp` |
| `GettingStartedAddContextButton` | 01-Getting-started | `html-Yh-op15ztNMa3a3it3Fop` |
| `GettingStartedSelectDeckTemplateButton` | 01-Getting-started | `html-8bLBiEpM1UQnNnsy3dq-X` |
| `SendPromptButton` | 01-Getting-started | `html-3aZRfxdEpZ7L7aa22J9zG` |
| `MultiplayerToolsButton` | 01-Getting-started | `html-SaIrIhpQh7LDhLc7Mumck` |
| `GettingStartedProfileAvatar` | 01-Getting-started | `html-tcfieZb5hq7clDClzdd6a` |
| `PresentButton` | 01-Getting-started | `html-DbzZMm-Pz2XMD3Gl106ls` |
| `ShareButton` | 01-Getting-started | `html-5efHXkwgjZExDnYlzT37S` |
| `DesignTabButton` | 01-Getting-started | `html-I8GOzRcIErgwqWJf0m_Zk` |
| `AnimateTabButton` | 01-Getting-started | `html-KGPOdQg1_XlPH7hj5pWDq` |
| `ZoomAndViewOptionsButton` | 01-Getting-started | `html-U2XuyOi0IfaJSdtTzqaQX` |
| `GettingStartedHelpButton` | 01-Getting-started | `html-7yLut7LjPZwS0m682L3nl` |
| `AgentsMainMenuButton` | AgentsPanel | `html-x5h7jLGLG5f1t_I8NlZcS` |
| `AgentsFileButton` | AgentsPanel | `html-sqGHnZz0O2KpudCyP_1P_` |
| `AgentsAgentsButton` | AgentsPanel | `html-8CpFWAVvx4Tt08mwzpBkY` |
| `AgentsInsertsButton` | AgentsPanel | `html-CjhZjgqv3X4qzZO97T6mi` |
| `AgentsUntitledFileNameButton` | AgentsPanel | `html-cmaSMQhKVcm8SHi5vbn74` |
| `AgentsEditFileMenuButton` | AgentsPanel | `html-yFKGXSQlK_6F1HJnkuyRz` |
| `AgentsGridViewButton` | AgentsPanel | `html-CcRu8UhYJdg-gbyGONlnW` |
| `MoreOptionsButton` | AgentsPanel | `html-KUEA6cvXVgOjVwaR-aNb4` |
| `ImproveTheDeckButton` | AgentsPanel | `html-ATWPnLSKpojp2mS8va4gX` |
| `AddToTheDeckButton` | AgentsPanel | `html-3n-8y31LKXbYlKOxSwGRQ` |
| `PrepareToPresentButton` | AgentsPanel | `html-2DO8f5baN09L7Vf0Hln43` |
| `UnderstandTheDeckButton` | AgentsPanel | `html-zYHMDXPPIQaTbojINhVJp` |
| `AgentsAddContextButton` | AgentsPanel | `html-IKpEe-t8_0bCN05gJ5o1k` |
| `AgentsSelectDeckTemplateButton` | AgentsPanel | `html-FQ6J67X73jlPAOtViX9W-` |
| `DictateButton` | AgentsPanel | `html-ZszYaOAGF4hpyUowlFQU1` |
| `SendButton` | AgentsPanel | `html-DtvLb9DtolK-7nT9SD_BI` |
| `NewChatButton` | AgentsPanel | `html-TjtHN90-u7nnZUPHDhkVg` |
| `AgentsNewSlideButton` | AgentsPanel | `html-t0zRRG_D5Fu6kx5K5kf6y` |
| `AgentsSlideButton` | AgentsPanel | `html-gKKzfi_y11v4QszJMjqnY` |
| `EditorTextButton` | GettingStartedEditorToolbar | `html-ftf_n_btehwV8fT-w6oTh` |
| `EditorImageVideoButton` | GettingStartedEditorToolbar | `html-Bndn4wFUKNCwQMwhnK5ez` |
| `EditorShapesButton` | GettingStartedEditorToolbar | `html-f7evK906Tzgixo6geI3lJ` |
| `EditorCommentButton` | GettingStartedEditorToolbar | `html-0wujmsVA2ak1mL4rn28ei` |
| `EditorActionsButton` | GettingStartedEditorToolbar | `html-IzGOL7hKUL7j5COryn9t8` |
| `EditorFrameButton` | GettingStartedEditorToolbar | `html-i8B618pDrKqhyRgdigkvt` |
| `EditorCommentButton2` | GettingStartedEditorToolbar | `html-TcyipGBkSfjTrrgxGe6sv` |
| `EditorActionsButton2` | GettingStartedEditorToolbar | `html-aB-_ycwA9gJAlybNfT4Gi` |
| `FileFileButton` | FilePanel | `html-8bCaedsiJK7ME12KbHxSV` |
| `FileAgentsButton` | FilePanel | `html-tnpWqt6HL1csSiQmiEPWT` |
| `FileGridViewButton` | FilePanel | `html-Fxv_-aGVPepmGeBvWVpXt` |
| `FileNewSlideButton` | FilePanel | `html-918oSVbK--RqDSrUOEXml` |
| `FileAddBlankSlideButton` | FilePanel | `html--NT01NXQseaSGp1mvUtGN` |
| `FileSlideButton` | FilePanel | `html-vWWzNQBgcE0J00ZpECPHl` |
| `InsertInsertsButton` | InsertPanel | `html-33g5jQ40uiYwpe2d6bPoC` |
| `TableButton` | InsertPanel | `html-tmFw3iPWCXuTpjO2M5cnh` |
| `CodeBlockButton` | InsertPanel | `html-IjomXS5A3imLibAn4JeT5` |
| `SlideNumberButton` | InsertPanel | `html-yM8ACDZs3igdNwYAaXNuR` |
| `InsertTextButton` | InsertPanel | `html--H4e5eDpUFwxmMufCOYqx` |
| `MediaButton` | InsertPanel | `html-mj9YI9zcekzvulvUULGSS` |
| `InsertShapesButton` | InsertPanel | `html-CyzzcceCYP9Yf53h26Cmj` |
| `PrototypesButton` | InsertPanel | `html-Bbq24_BUjAk6DEjkfI2Eq` |
| `InteractiveButton` | InsertPanel | `html-_-_-szUVG9eE1DbPFRElk` |
| `LibrariesButton` | InsertPanel | `html-l0HGR3EF1Tof2gz0tOzOG` |
| `MediaUntitledFileNameButton` | MediaPanel | `html-kC2aKWsmmGWZO-QLYHUUB` |
| `MediaEditFileMenuButton` | MediaPanel | `html-cT3Xzl99S3-3tvfFjtica` |
| `MediaSlideViewButton` | MediaPanel | `html-op3_XRE8cdPVMQcPcHTiW` |
| `MediaBackButton` | MediaPanel | `html--p4BD76OdYpoulkR_VFDV` |
| `MediaSearchFieldButton` | MediaPanel | `html-8KV9V3tbzYXXCx3Md6OCF` |
| `SearchStockPhotosInput` | MediaPanel | `html-E_tdk-MegWGbReB9gAHFP` |
| `MediaThumbnail01` | MediaPanel | `html-tWPLJmq-9uhUKdTWOuFjF` |
| `MediaThumbnail02` | MediaPanel | `html-Au0lecCpXP4YdrNEcHlVX` |
| `MediaThumbnail03` | MediaPanel | `html-aOKWyEnK4NXPbzQVAm2zJ` |
| `MediaThumbnail04` | MediaPanel | `html-EdoqCd-SgW3YRlsYdi4Fd` |
| `MediaThumbnail05` | MediaPanel | `html-XkKDAdM4bG9BIdj91LiN6` |
| `MediaThumbnail06` | MediaPanel | `html-vqudbtWNnRRVu8Pp-vngt` |
| `MediaThumbnail07` | MediaPanel | `html-TudZo-e6K38wcdjHW73_9` |
| `MediaThumbnail08` | MediaPanel | `html-pTf-aHjadACHcj9iPAHPT` |
| `MediaThumbnail09` | MediaPanel | `html-FLbHsOn9xy3j60wm0rk4B` |
| `MediaThumbnail10` | MediaPanel | `html-DW25WtDIvtJ7gB0In-Vcu` |
| `MediaThumbnail11` | MediaPanel | `html-ZYpsXrFBaWUcIP8WkwhYW` |
| `MediaThumbnail12` | MediaPanel | `html-iVbctyTKWUCQTNED0OcQG` |
| `MediaThumbnail13` | MediaPanel | `html-7nVZFPoG4X_yfLTZZmSOc` |
| `MediaThumbnail14` | MediaPanel | `html-M0GQL3G_mDI39_xZBqSzG` |
| `MediaThumbnail15` | MediaPanel | `html-msEtVugxUtFQESDGX9bJz` |
| `MediaThumbnail16` | MediaPanel | `html-4azOf39se59r1kJPETFzc` |
| `MediaThumbnail17` | MediaPanel | `html-ykJvMwprr1ZDQfXrG9Gvb` |
| `MediaThumbnail18` | MediaPanel | `html-cKQCO_X0jW3E8f0OV7QOy` |
| `MediaThumbnail19` | MediaPanel | `html-MTYF1i5NtUm1J_mb81coc` |
| `MediaThumbnail20` | MediaPanel | `html-s52tsOjdR76KpMop5iEig` |
| `MediaThumbnail21` | MediaPanel | `html-AbLWC9H1fXwjaFV5mJm5U` |
| `MediaThumbnail22` | MediaPanel | `html--KxqcOaPGxXa3ysG4QAWb` |
| `MediaThumbnail23` | MediaPanel | `html-6IsmHIjKN8I2GtZEeQegS` |
| `MediaThumbnail24` | MediaPanel | `html-BuvTMgsSTAKzJ06ipbwSg` |
| `MakeAnImageButton` | MediaPanel | `html-Nu8-QPbz2FQiS5kpf2c3Q` |
| `UploadImageOrVideoButton` | MediaPanel | `html-NGwNLEbkz_vOqJydenxKz` |
| `StartWithAnAIDraftButton` | PresenterNotes | `html-3jicBjplJ_OkIL1tVRAY7` |
| `AdjustToneButton` | PropertiesPanel | `html-_yzdG7CeuSKDTJyoRMi6D` |
| `EditTemplateStyleButton` | PropertiesPanel | `html-qxUSDkVutZ7XOAikfQOUg` |
| `StyleOptionsButton` | PropertiesPanel | `html-ceDsOiMqslMHw-m1TxGK8` |
| `ColorPickerButton` | PropertiesPanel | `html-R7GrAiCODNVHL5ooo8RoT` |
| `ColorSwatchBlackButton` | PropertiesPanel | `html-W5WzBAqob38iBr0DIFIe3` |
| `ColorSwatchWhiteButton` | PropertiesPanel | `html-SfQBNAPS59G8_fMrAbAgf` |
| `ShapesMoveButton` | ShapesEditorToolbar | `html-JFkkD-NMgIOojOs9jK8F5` |
| `ShapesMoveToolsButton` | ShapesEditorToolbar | `html-yTY5Q1pDNvd_cMaWDI8eg` |
| `ShapesTextButton` | ShapesEditorToolbar | `html-toy571h_okZoJOF2zc-tG` |
| `ShapesImageVideoButton` | ShapesEditorToolbar | `html-bYdPOXE_RJmsTlgb4qpNT` |
| `ShapesShapesButton` | ShapesEditorToolbar | `html-VPtu4_vuHm-GOJW2I8kdP` |
| `ShapesCommentButton` | ShapesEditorToolbar | `html-SIzHSI4dCcpraFy9aug1r` |
| `ShapesActionsButton` | ShapesEditorToolbar | `html-vOe6hJrqECdCZYKhHYYlR` |
| `ShapesMoveButton2` | ShapesEditorToolbar | `html-TfXVm3ocaYBgiPNWs_Cqs` |
| `ShapesMoveToolsButton2` | ShapesEditorToolbar | `html-j0WmXzh9AqNCOpdlCqZ2W` |
| `ShapesFrameButton` | ShapesEditorToolbar | `html-LMKUVf06L0yR2tboZ7gM5` |
| `ShapesRectangleButton` | ShapesEditorToolbar | `html-0novuUukvbpjk2xkmOlil` |
| `ShapesShapeToolsButton` | ShapesEditorToolbar | `html-BNeYSKIhsQbcRPfYsDpzu` |
| `ShapesPenButton` | ShapesEditorToolbar | `html-ZnCr0R9OmOTwvYiVqi5xq` |
| `ShapesCreationToolsButton` | ShapesEditorToolbar | `html-cP7fok9FozNUTjFNP2pKh` |
| `ShapesTextButton2` | ShapesEditorToolbar | `html-ARP4rpum2P_4lLNHSyc5_` |
| `ShapesTypeToolsButton` | ShapesEditorToolbar | `html-M_2X3O4WKdD5tksJYglZ7` |
| `ShapesCommentButton2` | ShapesEditorToolbar | `html-EYjXQbdrKDROh8-EBqast` |
| `ShapesActionsButton2` | ShapesEditorToolbar | `html-2MhsARAYr9wDB71EM0vSI` |
| `ShapesAssetsButton` | ShapesEditorToolbar | `html-Ht0VC7osV2NYXCqhktPzS` |
| `ArrowButton` | ShapesEditorToolbar | `html-up_uSXXx3vTvMCGqkWyrN` |
| `LineButton` | ShapesEditorToolbar | `html-s5lVBrhQ2k1Ge0AF0C3vH` |
| `SquareButton` | ShapesEditorToolbar | `html-Yfn6mFX1Pd2HnDfYJaJbd` |
| `EllipseButton` | ShapesEditorToolbar | `html-F3hXnbwdY6HqVNs37OGN3` |
| `DiamondButton` | ShapesEditorToolbar | `html-R9FIAg0viPjU8Hxt-yHwS` |
| `TriangleButton` | ShapesEditorToolbar | `html-mYkYOcIu1P7vEFaDfWaUb` |
| `StarButton` | ShapesEditorToolbar | `html-0ojFqfjcKfc6aCkyj5_WL` |
| `PlusButton` | ShapesEditorToolbar | `html-XAZCDlvG_CDLGdGZC_Yv3` |
| `LeftArrowButton` | ShapesEditorToolbar | `html-u3JVhLEFvVkk7-HzfojID` |
| `RightArrowButton` | ShapesEditorToolbar | `html-aJeACPrC-Kp2w0fE63mRm` |
| `SpeechBubbleButton` | ShapesEditorToolbar | `html-0yEzrYVMFRJJLFAO9XL0c` |
| `MoreShapesButton` | ShapesEditorToolbar | `html-oqZrGnB4NKD9Oj543FJwK` |
| `CopyLinkButton` | ShareDialog | `html-7RK0ZJaRtXL4Mi5-Tx2Yb` |
| `InviteEmailFieldButton` | ShareDialog | `html-HRF3oVS_SRLjwR81fPAaG` |
| `InviteEmailsInput` | ShareDialog | `html-OoB0Dsoko7ldSNPZPk2a3` |
| `InviteButton` | ShareDialog | `html-xR9jVPCRYqTJ11R8OPTYP` |
| `AnyoneCanViewButton` | ShareDialog | `html-UmNBZGFML1CeaKVmTntO3` |
| `ShareMoveToFolderButton` | ShareDialog | `html-BmEz6Qx4kcfRW1-BjwGgR` |
| `ShareCloseButton` | ShareDialog | `html-xdZ71AZTxBK9PIkRPwmjH` |
| `ShareMoreMoveToFolderButton` | ShareMoreActions | `html-BmEz6Qx4kcfRW1-BjwGgR` |
| `TextUntitledFileNameButton` | TextPanel | `html-d8x9cfimvbzstmG1qcE2P` |
| `TextEditFileMenuButton` | TextPanel | `html-Obx_IDVUF8LVY-KazN1Op` |
| `TextSlideViewButton` | TextPanel | `html-CxCKUobM3oLQUFIbBIl3w` |
| `TextBackButton` | TextPanel | `html-Iat4Db9DUMAz4PwDx6Fb5` |
| `AddTextBoxButton` | TextPanel | `html-hDdRnqO5ArhE495-1MlVp` |
| `TextTextButton` | TextPanel | `html-1dfKvcL0YdeKhcWJR2qMo` |
| `TextStyleTitleButton` | TextPanel | `html-LrpVpCJybdi7YnghttlGS` |
| `TextStyleHeader1Button` | TextPanel | `html-U8Wf3mFnS42fdZr2rRjj0` |
| `TextStyleHeader2Button` | TextPanel | `html-L-9ZxlKdCoJwn8SW42IT4` |
| `TextStyleHeader3Button` | TextPanel | `html-7PVcUgU3AFpL9hIK1tp4L` |
| `TextStyleBody1Button` | TextPanel | `html-REcxEwsu_9nk_J3y8YtR4` |
| `TextStyleBody2Button` | TextPanel | `html--_9h4Vb9OAkuPCiKjLD0l` |
| `TextStyleBody3Button` | TextPanel | `html-_MyPypEUR3AE_TbHDX0_a` |
| `TextStyleNoteButton` | TextPanel | `html-CHKzUeB3HbIAbqMnFUHom` |
| `FontCombinationsButton` | TextPanel | `html-KHfC339DoFJgpbGMIzznO` |

## dialogs (3)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `GettingStartedDialog` | 01-Getting-started | `html-onauKqnMGMoOqLf-1Eii8` |
| `ShareDialog` | ShareDialog | `html-Yg0m1Zb-YJWF8S69ZHHTZ` |
| `ShareMoreActions` | ShareMoreActions | `html-w1i9qJLGlYnDtQgdlgRnS` |

## icons (162)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `AccountMenuIcon` | 00-Home | `html-uooakzjEeniIvqdztpu_P` |
| `NotificationBellIcon` | 00-Home | `html-X6cstehool7oX1e8peuqV` |
| `SearchIcon` | 00-Home | `html-Bl7CAGviSdDc7WtscAG7Q` |
| `ClockIcon` | 00-Home | `html-jvzUtSg0EDApRgi9qoIRJ` |
| `ResourcesIcon` | 00-Home | `html-vBf7XzibW4r0UVrMgQ_qG` |
| `PlanIcon` | 00-Home | `html-wUEAVbboZ3dQYJ7WxNBiv` |
| `HomeFileIcon` | 00-Home | `html-WSDKYYrNEEZtzYWqg_Rw_` |
| `HomeGridSmallIcon` | 00-Home | `html-odKdB0lUH0zURpf-T37C6` |
| `HomeLayoutIcon` | 00-Home | `html-iPjrbXDKNdOcmTbtq0xai` |
| `TrashIcon` | 00-Home | `html-oG3Mu24g8ccybTJXMhuwe` |
| `SettingsIcon` | 00-Home | `html-MMavkY3Qp1DwIFJQ_s96j` |
| `HomeChevronDownMutedIcon` | 00-Home | `html-shNdmbhaBVaCEGhQyJdvC` |
| `HomeFolderIcon` | 00-Home | `html-GVG2PPDK1bpx3GuAiXSZm` |
| `HomeFolderIcon2` | 00-Home | `html-9Ys5FsA8r9MdUZASSb7to` |
| `HomeBrandMarkIcon` | 00-Home | `html-kDLKJ6QgRyE5PQkeJuJwC` |
| `HomeBrandMarkIcon2` | 00-Home | `html-f-P-VIg1IFkJHCAhZdCtb` |
| `SlidesIcon` | 00-Home | `html-O0PN8DUCdPetyAM_KfVce` |
| `HomeSparkleIcon` | 00-Home | `html-uMEB7CJClCEkxqxoFZwNG` |
| `HomeMoreIcon` | 00-Home | `html-_nuqCOZabCB-DILzBIX_w` |
| `HomeSlidesFilledIcon` | 00-Home | `html-bvf0VtFvRJvbqERYmOCsF` |
| `ChevronDownBlueIcon` | 00-Home | `html-u_tRztEDIP0Kdx4enzt2u` |
| `HomeChevronDownMutedIcon2` | 00-Home | `html-lsXJoHjVQ0c6kwlxd5Wsm` |
| `HomeGridSmallIcon2` | 00-Home | `html-ag_Eq9TqjcgsUS-SKpWEo` |
| `ListIcon` | 00-Home | `html-oXScixDSzsmOFdhjF8TLp` |
| `HomeSlidesFilledIcon2` | 00-Home | `html-FdRs2N9VI6BFkFpTLV80z` |
| `HomeHelpIcon` | 00-Home | `html-aCSMcgMfqyccWJI3z2jws` |
| `GettingStartedMoveIcon` | 01-Getting-started | `html-bOe6rM4yvyiyXGVPjYwPg` |
| `GettingStartedChevronDownIcon` | 01-Getting-started | `html-RijHuIgm4sWQNVzQSjYXs` |
| `GettingStartedTextIcon` | 01-Getting-started | `html-ttlWExbSV_E9g5pMFrRev` |
| `GettingStartedImageVideoIcon` | 01-Getting-started | `html-dG3W2YadCEgcKaOSBbXXB` |
| `GettingStartedShapesIcon` | 01-Getting-started | `html-1OJP7dOufN5N6GVJpxBf5` |
| `GettingStartedCommentIcon` | 01-Getting-started | `html-xvHjnWLz7F1ZiseL3lyh4` |
| `GettingStartedActionsIcon` | 01-Getting-started | `html-FfSvQvsBffpnuglLVxG0g` |
| `GettingStartedMoveIcon2` | 01-Getting-started | `html-rhKcFOIU-OvBcLBeewNjx` |
| `GettingStartedChevronDownMutedIcon` | 01-Getting-started | `html-EH6YpibyBpPvSMXYL35oU` |
| `GettingStartedFrameIcon` | 01-Getting-started | `html-lKK3eSZbcUT_hEyOeqVVv` |
| `GettingStartedRectangleIcon` | 01-Getting-started | `html-kCJXzlrbOrzcjmAc352ei` |
| `GettingStartedPenIcon` | 01-Getting-started | `html--McZ0qdKDWEEGXVrwhjbn` |
| `GettingStartedTextIcon2` | 01-Getting-started | `html-H11F_q8heIcReUYVYpUnS` |
| `GettingStartedCommentIcon2` | 01-Getting-started | `html-HhCNcw_XeQ610C_YBsfBt` |
| `GettingStartedActionsIcon2` | 01-Getting-started | `html-lF6jMnb7i7r6ayHl0y6Yj` |
| `GettingStartedPlusMutedIcon` | 01-Getting-started | `html-0ouT8RFjDjlWQj6ABNCfm` |
| `GettingStartedSlidesOrangeIcon` | 01-Getting-started | `html-pB-xpi6LIMF7DpvANe38H` |
| `GettingStartedPrototypeToolsIcon` | 01-Getting-started | `html-rxKgkal9K7UqYK7DTcuwW` |
| `GettingStartedMainMenuIcon` | 01-Getting-started | `html-Fy4TGNoboV6EP2fcxvJAL` |
| `GettingStartedFileOrangeIcon` | 01-Getting-started | `html-UXuHKFoBfec1DBN1zTMWO` |
| `GettingStartedSparkleIcon` | 01-Getting-started | `html-kkT3NRfo2TjQ028awUpxo` |
| `GettingStartedAddCircleIcon` | 01-Getting-started | `html-O4gu0J6OJN96J8oVsU1xf` |
| `GettingStartedChevronDownIcon2` | 01-Getting-started | `html-b2X2vGd33tbPVOHrDW2Fq` |
| `GettingStartedGridLargeIcon` | 01-Getting-started | `html-Wo0eBdjowQLn-Y4unl3JD` |
| `GettingStartedNewSlideIcon` | 01-Getting-started | `html-leKOEXARk0ximrTceIi0t` |
| `GettingStartedAddBlankSlideIcon` | 01-Getting-started | `html-SA-C0IA1M3e138OSSAQDI` |
| `SlidesFilledLargeIcon` | 01-Getting-started | `html-ttwSmjIsXoXglhx0rdx2q` |
| `GettingStartedCloseIcon` | 01-Getting-started | `html-y7Ce9zjrUMtCKz5x4F37r` |
| `GettingStartedPlusIcon` | 01-Getting-started | `html-r-3a6xLeBYVkcKT1QYmS3` |
| `SelectDeckTemplateIcon` | 01-Getting-started | `html-WiQcgxphHrPfZG9oNxcee` |
| `SendPromptIcon` | 01-Getting-started | `html-AahVg8VpSa9T2THi-VsMj` |
| `QIcon` | 01-Getting-started | `html-RMDj1AfkHpoQ5SLP_a_16` |
| `PresentIcon` | 01-Getting-started | `html-MMAmGkcuY51hTHSU3b3MI` |
| `ZoomAndViewOptionsIcon` | 01-Getting-started | `html-CvwAPApxw7nzYaJhLD0BS` |
| `SelectOrangeIcon` | 01-Getting-started | `html-clwgtYKpNyQTApHd5kzmu` |
| `GettingStartedHelpIcon` | 01-Getting-started | `html-WyaqgmLWssyRvQatNqqpt` |
| `AgentsMainMenuIcon` | AgentsPanel | `html-sOocEmgNskMumb0lVynV6` |
| `AgentsFileIcon` | AgentsPanel | `html-FOgLFLLlt7EzE3lQdzedh` |
| `SparkleOrangeIcon` | AgentsPanel | `html-2JzTY6WJimKsEdmy_ZjNA` |
| `AgentsAddCircleIcon` | AgentsPanel | `html-1Wx8eZxQStiKOfdy5xWW1` |
| `AgentsChevronDownIcon` | AgentsPanel | `html--qCLb4aaP1FZWcpp2Chi6` |
| `AgentsGridLargeIcon` | AgentsPanel | `html-PUjhWrhqNYw-N11nXatyA` |
| `AgentsMoreIcon` | AgentsPanel | `html-fTYOjy3qbpA4sqtphodUB` |
| `AddShapeOrangeIcon` | AgentsPanel | `html--gCXBPBuHCOpsHI_Ap1o2` |
| `PaletteMutedIcon` | AgentsPanel | `html-JKxk1A6JOFikYbDwCZGL6` |
| `AgentsChevronDownMutedIcon` | AgentsPanel | `html-dKLUfjW1uS808GHf0bcDK` |
| `AddCircleMutedIcon` | AgentsPanel | `html-AU-O0UbFj0Vhz2wODwqv3` |
| `AgentsChevronDownMutedIcon2` | AgentsPanel | `html-9dsxoBO_T19bvDHF0GspD` |
| `AddTextBlockIcon` | AgentsPanel | `html-I56p81NtW07hQ4ExWJU-N` |
| `AiListIcon` | AgentsPanel | `html-E3J38OG9gXraPDL6L5NUD` |
| `AgentsPlusIcon` | AgentsPanel | `html-bwZ4kvQX5c4nl0h_SbHU6` |
| `PaletteIcon` | AgentsPanel | `html-rCKnkrnWb8TZNoSss5re4` |
| `MicOrangeIcon` | AgentsPanel | `html-btpo5V_X7iAY8WO1DrbkX` |
| `ArrowUpIcon` | AgentsPanel | `html-NrggwqcMe0IKADc3zO534` |
| `AgentsSparkleIcon` | AgentsPanel | `html-6InnMRasKmG82l_ixDEBp` |
| `AgentsNewSlideIcon` | AgentsPanel | `html-0BnEJvRE-g5pltXttrjSp` |
| `EditorTextIcon` | GettingStartedEditorToolbar | `html-nW-EPcTinq2C_J2Usf8a4` |
| `EditorImageVideoIcon` | GettingStartedEditorToolbar | `html-NYR8D8J4ydPqTAZiyxxzZ` |
| `EditorShapesIcon` | GettingStartedEditorToolbar | `html-CCCdWES-EQd_iN0m7Uai8` |
| `EditorSlidesOrangeIcon` | GettingStartedEditorToolbar | `html-5xnzyFzU1qJ0U8NOP4p33` |
| `EditorPrototypeToolsIcon` | GettingStartedEditorToolbar | `html-J8fvd_9C0qT5nwnLlNijZ` |
| `FileFileOrangeIcon` | FilePanel | `html-ihyYdDPGN_9DxdCo1i6q8` |
| `FileSparkleIcon` | FilePanel | `html-tqr9ZIBa9DiJXe21l46Md` |
| `FileAddBlankSlideIcon` | FilePanel | `html-VZ_fCml56IjPklU-deJNW` |
| `AddCircleOrangeIcon` | InsertPanel | `html-mjQDELukAnW89fEjHZFoL` |
| `TableIcon` | InsertPanel | `html-Op6Ms2JpWHVFHiQ_dPG16` |
| `CodeBlockIcon` | InsertPanel | `html-dtBOSot1GtmjfzQIOPb3B` |
| `SlideNumberIcon` | InsertPanel | `html-uwzNlx-v3hCFd5l28nSfF` |
| `BrandLetterIcon` | Logo | `html-NcG-H6ymZ1Q1zTCEuypqX` |
| `PinkStrokeIcon` | Logo | `html-NglcaxkPe2Z6UYsSb9aAn` |
| `MediaChevronDownIcon` | MediaPanel | `html-MVEkfRlGGnfJmx5Xs66lz` |
| `MediaSlideViewIcon` | MediaPanel | `html-juDhWRIoz3HPW3bt06-D9` |
| `MediaChevronLeftIcon` | MediaPanel | `html-aYtkbE82bVXkTsE1GVpas` |
| `SearchMutedIcon` | MediaPanel | `html-xV_xgJnctyLyHI3lRPLWE` |
| `AddImageIcon` | MediaPanel | `html-tRjZ-AzwYD4TL4TnW59rA` |
| `UploadIcon` | MediaPanel | `html-boZ_ouDAv94UpzKCHPUU4` |
| `MoveVIcon` | MoveMenu | `html-SHJ5RSuFSJPXJL321npxH` |
| `CursorIcon` | MoveMenu | `html-vU7KPZooQqIsyZGugoIsx` |
| `HandIcon` | MoveMenu | `html--R2Th_FTzS04eApmbAhJc` |
| `ScaleToolIcon` | MoveMenu | `html-OKoPnbO9jvhMXlLOnARLY` |
| `StartWithAnAIDraftIcon` | PresenterNotes | `html-hJlbP_uXRD_0V18JtACPZ` |
| `AiTextIcon` | PropertiesPanel | `html-0m_z1OuIdFftUGXrt0T6W` |
| `AdjustIcon` | PropertiesPanel | `html-nwkolOoiaUWXo2_j0iANk` |
| `PropertiesFrameIcon` | PropertiesPanel | `html-K7f1FjSs6Kra8TH8mu8Wn` |
| `TextureIcon` | PropertiesPanel | `html-Nx6dBmMs0TekyU9Py9Dau` |
| `ImageIcon` | PropertiesPanel | `html-fJsUotbaTxHd6jmchnj2w` |
| `PropertiesChevronDownIcon` | PropertiesPanel | `html-RsYM0p8M52Hv7S2_y3r1I` |
| `ShapesMoveIcon` | ShapesEditorToolbar | `html-wrUZhQc7-gGzLUlIglcSf` |
| `ShapesChevronDownIcon` | ShapesEditorToolbar | `html-Q9Et2ec0Tu0hQfK_Xr3pB` |
| `ShapesTextIcon` | ShapesEditorToolbar | `html-ZFbWqK6b4NKqIb1WAwAjf` |
| `ShapesImageVideoIcon` | ShapesEditorToolbar | `html--8uIbGYxdfia98EwUYfRe` |
| `ShapesShapesIcon` | ShapesEditorToolbar | `html-D7NHwxiCA_VcA4ni2Oqmn` |
| `ShapesCommentIcon` | ShapesEditorToolbar | `html-lg94mhi1EpSh7MU42fdfm` |
| `ShapesActionsIcon` | ShapesEditorToolbar | `html-Ec4ZRLRO8VAZze4iE0THw` |
| `ShapesMoveIcon2` | ShapesEditorToolbar | `html-VxvXxIi0RiN0ym6-l3crE` |
| `ShapesChevronDownMutedIcon` | ShapesEditorToolbar | `html-F8Z3Mkv2l85cz-L-uFXOf` |
| `ShapesFrameIcon` | ShapesEditorToolbar | `html-BZ-VoYRHOtxJ8kj3HtJty` |
| `ShapesRectangleIcon` | ShapesEditorToolbar | `html-H3nKQtbv50hofhWC1aCMp` |
| `ShapesPenIcon` | ShapesEditorToolbar | `html-cicgcI3TCdHE3r6tDUGJ9` |
| `ShapesTextIcon2` | ShapesEditorToolbar | `html-2ct0VFueJbnLrGxYlYtGX` |
| `ShapesCommentIcon2` | ShapesEditorToolbar | `html-esvc6WIgrxzxpgJFzNRK8` |
| `ShapesActionsIcon2` | ShapesEditorToolbar | `html-s9i8YQPqJLiv35gccHbZS` |
| `ShapesPlusMutedIcon` | ShapesEditorToolbar | `html-xjeBeNqF5-SMrwDLQqrRD` |
| `ShapesSlidesOrangeIcon` | ShapesEditorToolbar | `html-NeDNP-yNBISy8sxGzoU8E` |
| `ShapesPrototypeToolsIcon` | ShapesEditorToolbar | `html-8qD8L30d8D9SoOXqoclxc` |
| `ArrowIcon` | ShapesEditorToolbar | `html-xJ4xwnFh8IBqazSdxycKi` |
| `LineIcon` | ShapesEditorToolbar | `html-qyA10PSuFXWIYFHVrWeoQ` |
| `ShapeSquareIcon` | ShapesEditorToolbar | `html-d5zlnVYSnR86EDTpbohdf` |
| `ShapeCircleIcon` | ShapesEditorToolbar | `html-QXc02OwufApOi3LHFSB7-` |
| `ShapeDiamondIcon` | ShapesEditorToolbar | `html-hJolC6DPl_dl3RkurIeEd` |
| `ShapeTriangleIcon` | ShapesEditorToolbar | `html-E9WU3NtEdNYdtYbywcq_4` |
| `ShapeStarIcon` | ShapesEditorToolbar | `html-AZisfxhN6LC2gCe2W4_bD` |
| `ShapeCrossIcon` | ShapesEditorToolbar | `html-dlmRzGAeGj6H3oTT0QTfN` |
| `ShapeArrowLeftIcon` | ShapesEditorToolbar | `html-bcoTjvOMmXYjm-TTtH9sI` |
| `ShapeArrowRightIcon` | ShapesEditorToolbar | `html-jTGCaoKNSbW5wRohkeHBs` |
| `ShapeSpeechBubbleIcon` | ShapesEditorToolbar | `html-NFN5CcAjU36bybKsNCQhm` |
| `ShareCopyLinkIcon` | ShareDialog | `html-HVqT_CiupwmN3vdyAxCOD` |
| `ShareCopyLinkIcon2` | ShareDialog | `html-DonzJnjmIoQzOZM98dLs6` |
| `GlobeIcon` | ShareDialog | `html-3iv99N47orSqADVbn1r1G` |
| `CanViewIcon` | ShareDialog | `html-IP2yccd5gETOgJLFQPjyx` |
| `ShareChevronRightIcon` | ShareDialog | `html-bJxHf1yUO1zwCZNljvvRB` |
| `SharePlayIcon` | ShareDialog | `html-h_ZZ00XSxRrYOm4WrHpqT` |
| `ShareCodeFrameIcon` | ShareDialog | `html-BYkknyPYwD_iJ6ZpegQGJ` |
| `ShareUploadFolderIcon` | ShareDialog | `html-7ZwhVFbvnFFk_TiM-yo9q` |
| `ShareCloseIcon` | ShareDialog | `html-QwY33LCfyxrhWJ-VSuz3S` |
| `ShareMoreLayoutIcon` | ShareMoreActions | `html-LRcAuuGDnRTOJfjRsMwiJ` |
| `ShareMoreChevronRightIcon` | ShareMoreActions | `html-bJxHf1yUO1zwCZNljvvRB` |
| `ShareMorePlayIcon` | ShareMoreActions | `html-h_ZZ00XSxRrYOm4WrHpqT` |
| `ShareMoreCodeFrameIcon` | ShareMoreActions | `html-BYkknyPYwD_iJ6ZpegQGJ` |
| `ShareMoreUploadFolderIcon` | ShareMoreActions | `html-7ZwhVFbvnFFk_TiM-yo9q` |
| `TextChevronDownIcon` | TextPanel | `html-OPvwXU9Cl9VfaFayHjrFq` |
| `TextSlideViewIcon` | TextPanel | `html-rsZoIbgvneyBlrwWbV9Sl` |
| `TextChevronLeftIcon` | TextPanel | `html-A0oWrb8F3PETf5fHy01BF` |
| `AddTextBoxIcon` | TextPanel | `html-Tt86aJhpla8GP8v8Jgme6` |
| `TextChevronDownMutedIcon` | TextPanel | `html-ErBBAsYTDZ2spjU4g4aev` |
| `ChevronRightMutedIcon` | TextPanel | `html-7hqQAM_Ed4eiy6cOLLAPV` |

## navigation (22)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `HomeSidebar` | 00-Home | `html-_CFLwvoIIdxOgklhNE5QE` |
| `HomeHeader` | 00-Home | `html-hL-IVqAcVA8W9LBGWLux_` |
| `CreateFileButtons` | 00-Home | `html-qs9r1kr-S3tJq0zYM1d6O` |
| `HomeFileToolbar` | 00-Home | `html-s5iKjJIjMJIDa1Y47y1Lq` |
| `GettingStartedEditorToolbar` | 01-Getting-started | `html-aWrbr6un6qKBc0ry4JnPR` |
| `GettingStartedMoveToolGroup` | 01-Getting-started | `html-VhTqmgq_RM06hWYPfGfKL` |
| `GettingStartedMoveToolGroup2` | 01-Getting-started | `html-N9kxewGBh2UopIqO3ZnyN` |
| `GettingStartedRectangleToolGroup` | 01-Getting-started | `html-SH0-NNVnpGR88NjsT7Psu` |
| `GettingStartedPenToolGroup` | 01-Getting-started | `html-KWZKlVbpaOhXCtyRTB5Fb` |
| `GettingStartedTextToolGroup` | 01-Getting-started | `html-pFMSpWN8IJxO3mKuzstdG` |
| `EditorNavigationRail` | 01-Getting-started | `html-GqecoP-fC2k-XR9dbpsbj` |
| `EditorHeaderActions` | 01-Getting-started | `html-CxPf27s0LWdib82Hiab5m` |
| `InspectorTabsAndZoom` | 01-Getting-started | `html-Z6ySDMyrO6HWxMPtJjNnv` |
| `EditorEditorToolbar` | GettingStartedEditorToolbar | `html-uMZqBQu3Ow4NgHAYR-Ss0` |
| `EditorMoveToolGroup` | GettingStartedEditorToolbar | `html-YDWNP4Cmg7ImV9DHQuRAr` |
| `MoveToolMenu` | MoveMenu | `html-UDcbTSWhduiwBqKV9Dm_3` |
| `ShapesEditorToolbar` | ShapesEditorToolbar | `html-BC_L2kanwlU56wEKgs2py` |
| `ShapesMoveToolGroup` | ShapesEditorToolbar | `html-egQIa0rurgbKK1yxWSneB` |
| `ShapesMoveToolGroup2` | ShapesEditorToolbar | `html-c0r2jjBccLgP6knGQDBxO` |
| `ShapesRectangleToolGroup` | ShapesEditorToolbar | `html-e05_FbN3TApALswv8tHOo` |
| `ShapesPenToolGroup` | ShapesEditorToolbar | `html-zHfyHRbi-9_8YDDRpiJTc` |
| `ShapesTextToolGroup` | ShapesEditorToolbar | `html-_ksPUh9D5J9T33tLkWJ5J` |

## panels (7)

| Component | Source screen | Lunagraph id |
|---|---|---|
| `AgentsSidebar` | AgentsPanel | `html-9CplZw7GCPSQWZm7CLpWT` |
| `FileSidebar` | FilePanel | `html-yY31sApAYSkZxC2pl1NL1` |
| `InsertSidebar` | InsertPanel | `html-cFwqQ66Tha-zgfG3EL7zG` |
| `MediaSidebar` | MediaPanel | `html-YZ11bty2BsOXsSslF7f9w` |
| `PresenterNotes` | PresenterNotes | `html-ofFT-AvTL7IWFznh2J_7Y` |
| `SlidePropertiesPanel` | PropertiesPanel | `html-OZA4EHjAJ3yDmbNTEqF3a` |
| `TextPanel` | TextPanel | `html-Cs8BBIA07Dmi7pNVqMQ5p` |
