/**
 * MoveClassifier.js - Generates AI explanations for moves
 */

class MoveClassifier {
  /**
   * Generate explanation for why a move is classified as it is
   */
  static async explainMove(move, position, classification, evalDiff, engine) {
    const chess = new (require('chess.js').Chess)(position);
    const moveObj = chess.move(move);

    let explanation = '';

    // BEST MOVE
    if (classification === 'Best') {
      explanation = `Best move! ${moveObj.san} strengthens your position by controlling key squares and improving piece activity.`;
      
      // Add tactical/strategic detail
      if (moveObj.flags.includes('c')) {
        explanation += ` This capture removes a defender.`;
      }
      if (moveObj.flags.includes('p')) {
        explanation += ` This promotion secures a winning advantage.`;
      }
      if (chess.inCheck()) {
        explanation += ` This move puts the opponent in check.`;
      }
    }

    // GOOD MOVE
    else if (classification === 'Good') {
      explanation = `Good move! ${moveObj.san} improves your position without losing material. It develops pieces or strengthens your king safety.`;
    }

    // DECENT MOVE
    else if (classification === 'Decent') {
      explanation = `Decent move. ${moveObj.san} is playable but not optimal. Consider looking for stronger continuations next time.`;
    }

    // INACCURACY
    else if (classification === 'Inaccuracy') {
      explanation = `Inaccuracy! ${moveObj.san} loses some advantage. A better move would have been ${engine.bestMove || 'the engine\'s choice'}, which is stronger.`;
    }

    // MISTAKE
    else if (classification === 'Mistake') {
      explanation = `Mistake! ${moveObj.san} loses significant material or creates weaknesses. You should have played ${engine.bestMove || 'a different move'}.`;
    }

    // BLUNDER
    else if (classification === 'Blunder') {
      explanation = `Blunder! ${moveObj.san} is a critical error that loses the game. The position went from favorable to losing. Study why this move is bad.`;
    }

    // BRILLIANT
    else if (classification === 'Brilliant') {
      explanation = `Brilliant! ${moveObj.san} is a spectacular sacrifice that wins by force! This move demonstrates deep tactical vision.`;
    }

    return explanation;
  }

  /**
   * Get coach explanations in different styles
   */
  static getCoachExplanation(classification, evalDiff, moveObj, style = 'default') {
    const styles = {
      serious: {
        'Best': 'This move optimizes your position according to modern chess theory.',
        'Good': 'A sound continuation with no apparent weaknesses.',
        'Decent': 'While not the strongest option, this move is sustainable.',
        'Inaccuracy': 'This move reduces your advantage. Superior alternatives exist.',
        'Mistake': 'A significant oversight that deteriorates your position.',
        'Blunder': 'A catastrophic error that fundamentally alters the game.',
        'Brilliant': 'An exceptional move demonstrating superior calculation.'
      },
      meme: {
        'Best': `*chef's kiss* Perfection! That's how you play chess!`,
        'Good': 'Decent! Not bad, not bad at all!',
        'Decent': 'Eh, it works I guess...',
        'Inaccuracy': 'Oops! Could\'ve been better, my dude.',
        'Mistake': 'YIKES! That was rough mate.',
        'Blunder': 'BROOOO!!! 💀 Did you even see the board??',
        'Brilliant': 'OOOOOH THAT\'S A 5HEAD MOVE!!! 🧠✨'
      },
      default: {
        'Best': 'Excellent! This is the strongest move here.',
        'Good': 'Good move! You\'re playing well.',
        'Decent': 'Alright, this move works but there might be something better.',
        'Inaccuracy': 'Hmm, that wasn\'t quite right. Did you consider other moves?',
        'Mistake': 'That was a mistake. What were you thinking?',
        'Blunder': 'Oh no! That was a major blunder!',
        'Brilliant': 'WOW! That\'s a brilliant sacrifice!'
      }
    };

    return styles[style]?.[classification] || styles.default[classification];
  }

  /**
   * Detect tactical patterns in a move
   */
  static detectTacticalPattern(position, move) {
    const chess = new (require('chess.js').Chess)(position);
    const moveObj = chess.move(move);

    const patterns = [];

    // Pin
    if (this.isPin(position, move)) patterns.push('Pin');

    // Fork
    if (this.isFork(chess.fen(), moveObj)) patterns.push('Fork');

    // Skewer
    if (this.isSkewer(position, move)) patterns.push('Skewer');

    // Sacrifice
    if (moveObj.flags.includes('c') && moveObj.captured) {
      patterns.push('Sacrifice');
    }

    // Promotion
    if (moveObj.flags.includes('p')) {
      patterns.push('Promotion');
    }

    // Check
    if (chess.inCheck()) patterns.push('Check');

    return patterns;
  }

  static isPin(fen, move) {
    // Simplified - returns true if move pins an opponent's piece
    // Implementation depends on chess.js library
    return false; // Placeholder
  }

  static isFork(fen, moveObj) {
    // Simplified - returns true if move attacks multiple pieces
    return false; // Placeholder
  }

  static isSkewer(fen, move) {
    // Simplified - returns true if move skewers pieces
    return false; // Placeholder
  }
}

module.exports = MoveClassifier;
