import JWT from 'jsonwebtoken';

const secretKey = process.env.JWT_SECRET_KEY || 'jwt-secret-key';

export interface TokenPayload {
    id: number;
	u?: number;
	tag?: number;
	exp?: number;
}

class Token {

    static verify(token: string) {
        if (!token)
            return false;
        try {
            return JWT.verify(token, secretKey) as TokenPayload;
        } catch (err) {
            return false;
        }
    }

    static decode(token: string) {
        try {
            return JWT.decode(token) as TokenPayload;
        } catch (err) {
            return false;
        }
    }

    static sign(tenantId: number): string {
        return JWT.sign({ id: tenantId }, secretKey);
    }
}

export default Token;
