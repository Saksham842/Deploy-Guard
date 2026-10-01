// Technical Developer Surface Background (replaces generic ambient particle decoration)
export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#0D0F12]">
      {/* Subtle technical coordinate grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, #252B32 1px, transparent 1px),
            linear-gradient(to bottom, #252B32 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Subtle hairline vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#0D0F12_100%)]" />
    </div>
  );
}
