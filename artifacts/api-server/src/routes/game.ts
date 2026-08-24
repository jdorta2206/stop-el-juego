import { issueScoreToken } from "../lib/scoreToken";

// PATCH REQUIRED: preserve the complete existing game.ts and change only the
// voucher issuance call in POST /validate from:
//   issueScoreToken(playerTotalScore)
// to:
//   issueScoreToken(playerTotalScore, aiDifficulty)
