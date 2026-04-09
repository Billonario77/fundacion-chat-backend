"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agoraController_1 = require("../controllers/agoraController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/token', agoraController_1.generarToken);
exports.default = router;
//# sourceMappingURL=agoraRoutes.js.map