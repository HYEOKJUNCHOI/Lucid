/**
 * FreeStudy 진입 시 기본으로 열리는 샘플 Java 코드.
 * - 싱글톤 패턴 + 생활 소재 (카페 주문 시스템)
 * - 10줄 이상 → 뱃지 획득 가능
 */
export const SAMPLE_JAVA_CODE = `package study;

// 카페는 하나뿐 — 싱글톤 패턴
public class 카페 {
    private static 카페 instance;
    private String 이름;
    private int 주문수 = 0;

    private 카페(String 이름) {
        this.이름 = 이름;
    }

    public static 카페 getInstance() {
        if (instance == null) {
            instance = new 카페("스타벅스 강남점");
        }
        return instance;
    }

    public void order(String 메뉴) {
        주문수++;
        System.out.println("[" + 이름 + "] " + 메뉴 + " 주문 완료 (총 " + 주문수 + "건)");
    }

    public static void main(String[] args) {
        카페 카운터1 = 카페.getInstance();
        카페 카운터2 = 카페.getInstance();

        카운터1.order("아메리카노");
        카운터2.order("카페라떼");

        System.out.println(카운터1 == 카운터2); // true — 같은 카페
        System.out.println("총 주문: " + 카운터1.주문수 + "건");
    }
}`;
