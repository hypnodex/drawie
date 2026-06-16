// Expo config plugin: disable Apple Pencil "Scribble" app-wide.
//
// iPadOS attaches a UIScribbleInteraction (and UIIndirectScribbleInteraction) to every editable text
// field. While one has focus, the Apple Pencil is hijacked into handwriting-to-text — gray ink painted
// over the UI that fades as it "recognises" — instead of drawing on the canvas. For a drawing app that's
// never wanted, so we swizzle UIView.addInteraction(_:) to drop scribble interactions before attach.
// The Pencil then always draws / picks colours; keyboard typing in text fields is unaffected.
//
// The ios/ folder is gitignored, so this plugin re-applies the edit whenever the native project is
// regenerated (expo prebuild). It mirrors the hand-edit in ios/Drawie/AppDelegate.swift.
const { withAppDelegate } = require('@expo/config-plugins')

const MARKER = 'drawieDisableScribble'

const SWIZZLE_BLOCK = `import UIKit
import ObjectiveC

// ─── Disable Apple Pencil handwriting app-wide (added by plugins/withDisableScribble.js) ──────────────
// iPadOS 26 drives Pencil handwriting via PencilKit (PKTextInputInteraction on a global editing overlay),
// not a class named "Scribble". Drop it so the Pencil draws/picks; keyboard typing stays intact.
private func drawieIsHandwriting(_ interaction: UIInteraction) -> Bool {
  let name = String(describing: type(of: interaction))
  return name.contains("Scribble") || name.contains("Handwriting") || name.contains("PKTextInput")
}

extension UIView {
  @objc dynamic func drawie_addInteraction(_ interaction: UIInteraction) {
    if drawieIsHandwriting(interaction) { return }
    drawie_addInteraction(interaction) // swapped → original implementation
  }

  @objc dynamic func drawie_didMoveToWindow() {
    drawie_didMoveToWindow() // swapped → original implementation
    for i in interactions where drawieIsHandwriting(i) { removeInteraction(i) }
  }
}

// Swift global \`let\` is initialised lazily exactly once (thread-safe == dispatch_once).
private let drawieDisableScribble: Void = {
  func exchange(_ cls: AnyClass, _ a: Selector, _ b: Selector) {
    guard let m1 = class_getInstanceMethod(cls, a), let m2 = class_getInstanceMethod(cls, b) else { return }
    method_exchangeImplementations(m1, m2)
  }
  exchange(UIView.self, #selector(UIView.addInteraction(_:)), #selector(UIView.drawie_addInteraction(_:)))
  exchange(UIView.self, #selector(UIView.didMoveToWindow), #selector(UIView.drawie_didMoveToWindow))
}()

`

module.exports = function withDisableScribble(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withDisableScribble expects a Swift AppDelegate')
    }
    let contents = cfg.modResults.contents
    if (contents.includes(MARKER)) return cfg // idempotent

    // 1) Inject the swizzle block immediately before the @main attribute.
    contents = contents.replace(/@main\b/, `${SWIZZLE_BLOCK}@main`)

    // 2) Install it on the first line of didFinishLaunchingWithOptions (before RN/text fields exist).
    contents = contents.replace(
      /(didFinishLaunchingWithOptions[\s\S]*?->\s*Bool\s*\{)/,
      '$1\n    _ = drawieDisableScribble // install Pencil-Scribble suppression before any text field',
    )

    cfg.modResults.contents = contents
    return cfg
  })
}
