# A drag leaves the filmstrip and the Design panel alone until it lands

`tests/browser/editor-drag-leaves-panels.spec.ts` selects a shape on the Doom editor with the Design panel open, holds a drag, and fails when a mutation observer on the filmstrip or on the panel sees a change before the pointer goes up. After the drop it waits for both to change, so an observer that sees nothing cannot pass. Its first version went with the old editor in `9b0587d26`.
