"use client";

interface MoveHistoryProps {
  moves: string[];
  currentMoveIndex?: number;
}

export function MoveHistory({ moves, currentMoveIndex = -1 }: MoveHistoryProps) {
  // Group moves into pairs (white, black)
  const movePairs: { white: string; black?: string }[] = [];
  
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      white: moves[i],
      black: moves[i + 1] || undefined
    });
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Move History</h3>
      
      {moves.length === 0 ? (
        <div className="text-slate-400 text-sm text-center py-8">
          No moves yet
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 text-sm">
            {/* Header */}
            <div className="text-slate-400 font-medium">#</div>
            <div className="text-slate-400 font-medium">White</div>
            <div className="text-slate-400 font-medium">Black</div>
            
            {/* Move rows */}
            {movePairs.map((pair, index) => (
              <div key={index} className="contents">
                <div className="text-slate-300 font-mono py-1">
                  {index + 1}
                </div>
                <div className={`
                  font-mono py-1 px-2 rounded transition-colors
                  ${currentMoveIndex === index * 2 
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                    : "text-white hover:bg-slate-700/30"
                  }
                `}>
                  {pair.white}
                </div>
                <div className={`
                  font-mono py-1 px-2 rounded transition-colors
                  ${currentMoveIndex === index * 2 + 1 
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                    : pair.black 
                      ? "text-white hover:bg-slate-700/30" 
                      : "text-slate-600"
                  }
                `}>
                  {pair.black || "..."}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Move count */}
      {moves.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400 text-center">
          {moves.length} move{moves.length !== 1 ? 's' : ''} played
        </div>
      )}
    </div>
  );
}

