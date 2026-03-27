a=int(input("Enter first number: "))
b=int(input("Enter second number: "))
n=int(input("Enter last number: "))

print(a)
print(b)
c=a+b

while(c<=n):
    print(c)
    a=b
    b=c
    c=a+b