const email: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function validate(schemas: {field: string, type: string, required: boolean}[], req: any) {
    for (const schema of schemas) {
        if (schema.required && !req[schema.field]) {
            throw Error(`${schema.field} is required`)
        }
        if (req[schema.field]) {
            if (schema.type === 'email') {
                if (!email.test(req[schema.field])) throw Error(`${schema.field} is invalid`);
            } else if (typeof req[schema.field] !== schema.type) {
                throw Error(`type ${typeof req[schema.field]} unable to assign to type ${schema.type}`)
            }
        }
    }
}