// Make the macOS icon from the mobile one: the same art inside Apple's rounded square
// (824 px tile centred on a clear 1024 px canvas).
// Run: swift scripts/icon/mac.swift assets/icon.png <out.png> && npx tauri icon <out.png>
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let src = NSImage(contentsOfFile: args[1])?.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fatalError("usage: mac.swift <source.png> <out.png>")
}
let size = 1024, tile: CGFloat = 824, radius: CGFloat = 185
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let inset = (CGFloat(size) - tile) / 2
let rect = CGRect(x: inset, y: inset, width: tile, height: tile)
ctx.interpolationQuality = .high
ctx.addPath(CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil))
ctx.clip()
ctx.draw(src, in: rect)
let png = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: args[2]))
