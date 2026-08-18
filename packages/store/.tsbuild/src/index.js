import { ignoreKey } from '@gochim/core';
/**
 * `@gochim/store` — 무시 사전.
 *
 * 교정기에서 "이건 내가 일부러 이렇게 쓴 거야"를 기억하지 못하면,
 * 같은 밑줄을 매번 다시 지워야 한다. 그 피로가 쌓이면 사용자는 도구를 끈다.
 * 그래서 무시 사전은 부가 기능이 아니라 **재방문을 만드는 장치**다.
 *
 * 저장은 IndexedDB에 한다 — 텍스트를 서버로 보내지 않는다는 전제를 지키면서
 * 브라우저를 닫아도 남는 유일한 선택지다. IndexedDB가 없으면(테스트·Node)
 * 메모리에만 두고 조용히 동작한다.
 *
 * ```ts
 * const store = await openIgnoreStore()
 * check(text, { ignore: store.keys() })   // 동기 Set을 그대로 넘긴다
 * await store.add(diagnostic)
 * ```
 */
const DB_NAME = 'gochim';
const DB_VERSION = 1;
const STORE = 'ignored';
// 키 생성은 코어의 `ignoreKey`를 그대로 쓴다. 여기서 다시 만들면 언젠가 반드시 어긋난다.
function openDatabase(dbName) {
    return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') {
            resolve(null);
            return;
        }
        let request;
        try {
            request = indexedDB.open(dbName, DB_VERSION);
        }
        catch {
            resolve(null);
            return;
        }
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        // 사생활 보호 모드 등에서 막히면 메모리 모드로 조용히 내려간다.
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
}
function readAll(db) {
    return new Promise((resolve) => {
        try {
            const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve([]);
        }
        catch {
            resolve([]);
        }
    });
}
function write(db, action) {
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readwrite');
            action(tx.objectStore(STORE));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
        }
        catch {
            resolve();
        }
    });
}
/**
 * 무시 사전을 연다.
 *
 * 저장된 항목을 전부 메모리로 읽어 온다 — 무시 목록은 수십~수백 개 규모라
 * 통째로 들고 있는 편이 매 검사마다 비동기로 묻는 것보다 훨씬 낫다.
 * 검사는 타이핑 중에 돌아야 하므로 동기여야 한다.
 */
export async function openIgnoreStore(options = {}) {
    const now = options.now ?? (() => Date.now());
    const db = await openDatabase(options.name ?? DB_NAME);
    const entries = new Map();
    const cachedKeys = new Set();
    if (db) {
        for (const entry of await readAll(db)) {
            entries.set(entry.key, entry);
            cachedKeys.add(entry.key);
        }
    }
    return {
        persistent: db !== null,
        keys: () => cachedKeys,
        list: () => [...entries.values()].sort((a, b) => b.at - a.at),
        async add(diagnostic) {
            const entry = {
                key: ignoreKey(diagnostic),
                text: diagnostic.text,
                ruleId: diagnostic.ruleId,
                at: now(),
            };
            entries.set(entry.key, entry);
            cachedKeys.add(entry.key);
            if (db)
                await write(db, (store) => store.put(entry));
        },
        async remove(key) {
            entries.delete(key);
            cachedKeys.delete(key);
            if (db)
                await write(db, (store) => store.delete(key));
        },
        async clear() {
            entries.clear();
            cachedKeys.clear();
            if (db)
                await write(db, (store) => store.clear());
        },
    };
}
//# sourceMappingURL=index.js.map