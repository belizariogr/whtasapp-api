import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { authMiddleware } from '../middleware/auth.ts';
import loginRoute from './login.route.ts';
import logoutRoute from './logout.route.ts';
import statusRoute from './status.route.ts';
import messagesTextRoute from './messages-text.route.ts';
import messagesLinkRoute from './messages-link.route.ts';
import messagesImageRoute from './messages-image.route.ts';
import messagesLinkButtonRoute from './messages-link-button.route.ts';
import messagesBulkRoute from './messages-bulk.route.ts';
import messagesLastReceivedRoute from './messages-last-received.route.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.use('*', authMiddleware);

app.route('/', loginRoute);
app.route('/', logoutRoute);
app.route('/', statusRoute);
app.route('/', messagesTextRoute);
app.route('/', messagesLinkRoute);
app.route('/', messagesImageRoute);
app.route('/', messagesLinkButtonRoute);
app.route('/', messagesBulkRoute);
app.route('/', messagesLastReceivedRoute);

export default app;
