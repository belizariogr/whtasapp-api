import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { authMiddleware } from '../middleware/auth.ts';
import registerRoute from './register.route.ts';
import loginRoute from './login.route.ts';
import logoutRoute from './logout.route.ts';
import unregisterRoute from './unregister.route.ts';
import statusRoute from './status.route.ts';
import messagesTextRoute from './messages-text.route.ts';
import messagesLinkRoute from './messages-link.route.ts';
import messagesImageRoute from './messages-image.route.ts';
import messagesLinkButtonRoute from './messages-link-button.route.ts';
import messagesBulkRoute from './messages-bulk.route.ts';
import messagesLastReceivedRoute from './messages-last-received.route.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.route('/', registerRoute);

const protectedRoutes = new Hono<{ Variables: AuthVariables }>();
protectedRoutes.use('*', authMiddleware);

protectedRoutes.route('/', loginRoute);
protectedRoutes.route('/', logoutRoute);
protectedRoutes.route('/', unregisterRoute);
protectedRoutes.route('/', statusRoute);
protectedRoutes.route('/', messagesTextRoute);
protectedRoutes.route('/', messagesLinkRoute);
protectedRoutes.route('/', messagesImageRoute);
protectedRoutes.route('/', messagesLinkButtonRoute);
protectedRoutes.route('/', messagesBulkRoute);
protectedRoutes.route('/', messagesLastReceivedRoute);

app.route('/', protectedRoutes);

export default app;
